import type { Paper } from "../../../shared/types.js";
import { chunkText, truncateByTokens } from "../utils/chunk.js";
import { storage } from "./storage.js";
import type { LlmClient } from "./llm.js";

/**
 * Tiny in-memory vector index, indexed by `paperId`. For larger corpora, swap
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

function cosine(a: number[], b: number[]): number {
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
  const allChunks = paper.metadata.sections
    .filter((s) => s.title !== "References")
    .flatMap((s) => chunkText(s.text, { sectionTitle: s.title }));

  if (allChunks.length === 0) return;
  const vectors = await embedClient.embed(allChunks.map((c) => c.text));
  const entries: IndexEntry[] = allChunks.map((c, i) => ({
    chunkIndex: i,
    sectionTitle: c.sectionTitle,
    text: c.text,
    vector: vectors[i],
  }));
  indexes.set(paper.metadata.id, entries);
}

export async function searchIndex(paperId: string, query: string, embedClient: LlmClient, topK = 5): Promise<IndexEntry[]> {
  const idx = indexes.get(paperId);
  if (!idx) return [];
  const [qv] = await embedClient.embed([query]);
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
  if (indexes.has(paperId)) return true;
  const paper = await storage.readPaper<Paper>(paperId);
  if (!paper) return false;
  await buildIndex(paper, embedClient);
  return true;
}