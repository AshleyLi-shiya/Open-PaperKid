import { writeFile } from "node:fs/promises";
import { paperIdFromArxiv } from "./pdfParser.js";
import { storage } from "./storage.js";

export interface ArxivEntry {
  arxivId: string;
  title: string;
  authors: string[];
  abstract: string;
  pdfUrl: string;
}

/**
 * arxiv.org does not require an API key. We use the public Atom API.
 */
export async function fetchArxivMeta(arxivId: string): Promise<ArxivEntry> {
  const cleanId = arxivId.replace(/v\d+$/, "").trim();
  const url = `http://export.arxiv.org/api/query?id_list=${encodeURIComponent(cleanId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`arxiv API failed: ${res.status}`);
  const xml = await res.text();
  // The Atom feed has a top-level <title> ("arXiv Query: ...") before the
  // <entry>. Slice the first entry so we don't accidentally parse the feed
  // title as the paper title.
  const entryMatch = xml.match(/<entry>[\s\S]*?<\/entry>/);
  const entryXml = entryMatch ? entryMatch[0] : xml;
  return parseArxivAtom(entryXml, cleanId);
}

function parseArxivAtom(xml: string, fallbackId: string): ArxivEntry {
  // Lightweight Atom parser using regex — avoids pulling xml2js dependency.
  const idMatch = xml.match(/<id>\s*(?:urn:uuid:|https?:\/\/arxiv\.org\/abs\/)?([0-9]+\.[0-9]+(?:v[0-9]+)?)\s*<\/id>/);
  const titleMatch = xml.match(/<title>\s*([\s\S]*?)\s*<\/title>/);
  const summaryMatch = xml.match(/<summary>\s*([\s\S]*?)\s*<\/summary>/);
  const authorMatches = [...xml.matchAll(/<author>\s*<name>\s*([^<]+?)\s*<\/name>\s*<\/author>/g)];

  const arxivId = idMatch?.[1] ?? fallbackId;
  const title = (titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim();
  const abstract = (summaryMatch?.[1] ?? "").replace(/\s+/g, " ").trim();
  const authors = authorMatches.map((m) => m[1].trim());

  return {
    arxivId,
    title,
    authors,
    abstract,
    pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
  };
}

export async function downloadArxivPdf(arxivId: string, destDir?: string): Promise<{ pdfPath: string; id: string; meta: ArxivEntry }> {
  const meta = await fetchArxivMeta(arxivId);
  const id = await paperIdFromArxiv(arxivId);
  const dest = destDir ?? storage.pdfPath(id);
  const res = await fetch(meta.pdfUrl, { headers: { "user-agent": "PaperKid/0.1" } });
  if (!res.ok) throw new Error(`Failed to download ${meta.pdfUrl}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return { pdfPath: dest, id, meta };
}

export async function searchArxiv(query: string, maxResults = 10): Promise<ArxivEntry[]> {
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&max_results=${maxResults}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`arxiv search failed: ${res.status}`);
  const xml = await res.text();
  // Parse multiple entries
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => parseArxivAtom(m[1], ""));
  return entries.filter((e) => e.arxivId);
}