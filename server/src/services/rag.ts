import type { Paper } from "../../../shared/types.js";
import { chunkText, truncateByTokens } from "../utils/chunk.js";
import { storage } from "./storage.js";
import type { LlmClient } from "./llm.js";

/**
 * Bounded in-memory index, keyed by paper ID and embedding endpoint/model. For larger corpora, swap
 * in sqlite-vss or qdrant; the API surface (buildIndex / search) stays the
 * same.
 */
interface IndexEntry {
  chunkIndex: number;
  sectionTitle?: string;
  text: string;
  vector: number[];
}

const indexes = new Map<string, IndexEntry[]>();
const cacheKey = (paperId: string, client: LlmClient) => JSON.stringify([paperId, client.embeddingKey]);

export function clearIndexes(paperId: string): void {
  for (const key of indexes.keys()) if (JSON.parse(key)[0] === paperId) indexes.delete(key);
}

function paperChunks(paper: Paper) {
  const sections = paper.metadata.sections.filter(s => !/^(references|bibliography|参考文献)$/i.test(s.title.trim()));
  const chunks = sections.flatMap(s => chunkText(s.text, { sectionTitle: s.title }));
  return chunks.length ? chunks : chunkText(paper.fullText, { sectionTitle: "Paper text" });
}

// Dependency-free lexical fallback; Chinese bigrams avoid whitespace-only matching.
function terms(text: string): Set<string> {
  const stop = new Set(["the", "and", "for", "this", "that", "what", "how", "does", "did", "with", "was", "are", "paper", "they"]);
  const words = (text.toLowerCase().match(/[a-z0-9]{2,}/g) || []).filter(w => !stop.has(w));
  for (const run of text.match(/[\u4e00-\u9fff]+/g) || []) for (let i = 0; i < run.length - 1; i++) words.push(run.slice(i, i + 2));
  return new Set(words);
}

export function searchKeywords(paper: Paper, query: string, topK = 6): IndexEntry[] {
  const wanted = terms(query);
  return paperChunks(paper).map((c, i) => {
    const present = terms(c.text + " " + (c.sectionTitle || ""));
    const score = [...wanted].filter(t => present.has(t)).length;
    return { chunkIndex: i, sectionTitle: c.sectionTitle, text: c.text, vector: [], score };
  }).filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, topK);
}

function validVector(v: number[] | undefined): v is number[] {
  return Array.isArray(v) && v.length > 0 && v.every(Number.isFinite) && v.some(n => n !== 0);
}

function cosine(a: number[], b: number[]): number {
  if (!validVector(a) || !validVector(b) || a.length !== b.length) throw new Error("Incompatible embedding vectors");
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

export async function buildIndex(paper: Paper, embedClient: LlmClient): Promise<void> {
  const allChunks = paperChunks(paper);

  if (allChunks.length === 0) return;
  const vectors = await embedClient.embed(allChunks.map((c) => c.text));
  if (vectors.length !== allChunks.length || !vectors.every(v => validVector(v) && v.length === vectors[0].length)) throw new Error("Invalid embedding response");
  const entries: IndexEntry[] = allChunks.map((c, i) => ({
    chunkIndex: i,
    sectionTitle: c.sectionTitle,
    text: c.text,
    vector: vectors[i],
  }));
  const key = cacheKey(paper.metadata.id, embedClient);
  indexes.delete(key);
  if (indexes.size >= 32) indexes.delete(indexes.keys().next().value!);
  indexes.set(key, entries);
}

export async function searchIndex(paperId: string, query: string, embedClient: LlmClient, topK = 5): Promise<IndexEntry[]> {
  const key = cacheKey(paperId, embedClient);
  const idx = indexes.get(key);
  if (!idx) return [];
  const [qv] = await embedClient.embed([query]);
  if (!validVector(qv) || qv.length !== idx[0]?.vector.length) {
    indexes.delete(key);
    throw new Error("Embedding model changed; index invalidated");
  }
  return idx
    .map((e) => ({ ...e, score: cosine(e.vector, qv) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function buildContextBlock(entries: { text: string; sectionTitle?: string }[]): string {
  return entries
    .map((e) => `[来源: ${e.sectionTitle ?? "未分类"}]\n${truncateByTokens(e.text, 400)}`)
    .join("\n\n---\n\n");
}

export async function ensureIndexed(paperId: string, embedClient: LlmClient): Promise<boolean> {
  if (indexes.has(cacheKey(paperId, embedClient))) return true;
  const paper = await storage.readPaper<Paper>(paperId);
  if (!paper) return false;
  await buildIndex(paper, embedClient);
  return indexes.has(cacheKey(paperId, embedClient));
}
