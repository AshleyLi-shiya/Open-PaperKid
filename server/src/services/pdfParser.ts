import fs from "node:fs/promises";
import { createHash } from "node:crypto";
// pdf-parse exports a function; use require under ESM to avoid type quirks.
import pdfParse from "pdf-parse";
import type { Paper, PaperMetadata, PaperSection } from "../../../shared/types.js";
import { config } from "../config.js";

// Section header heuristics. We split on likely headings; this is deliberately
// conservative — chat-paper uses similar pattern (Intro / Method / Conclusion).
const SECTION_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "Abstract", regex: /^[\s\n]*abstract[\s\n]*$/i },
  { name: "Introduction", regex: /^[\s\n]*(1\.?\s*)?(introduction|background)[\s\n]*$/i },
  { name: "Related Work", regex: /^[\s\n]*(2\.?\s*)?(related\s+work|prior\s+work)[\s\n]*$/i },
  { name: "Method", regex: /^[\s\n]*((3|4)\.?\s*)?(method|approach|methodology|model)[\s\n]*$/i },
  { name: "Experiments", regex: /^[\s\n]*((4|5|6)\.?\s*)?(experiments?|evaluation|results?)[\s\n]*$/i },
  { name: "Conclusion", regex: /^[\s\n]*((7|8|9|10|11|12)\.?\s*)?(conclusion|conclusions|discussion|summary)[\s\n]*$/i },
  { name: "References", regex: /^[\s\n]*references[\s\n]*$/i },
];

function splitSections(plainText: string): { sections: PaperSection[]; abstract: string } {
  // pdf-parse gives one paragraph per logical line break. Split into paragraphs.
  const lines = plainText.split(/\r?\n/);
  const sections: PaperSection[] = [];
  let current: PaperSection = { title: "Body", text: "" };
  let abstract = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const matched = SECTION_PATTERNS.find((p) => p.regex.test(trimmed));
    if (matched) {
      if (current.text.trim().length > 0) sections.push(current);
      current = { title: matched.name, text: "" };
    } else {
      current.text += (current.text ? "\n\n" : "") + trimmed;
    }
  }
  if (current.text.trim().length > 0) sections.push(current);

  // Always re-derive abstract: usually it's the first ~200-300 words.
  abstract = (sections.find((s) => s.title === "Abstract")?.text || plainText.trim()).slice(0, 2500);

  return { sections, abstract };
}

export async function parsePdf(buffer: Buffer, maxPages = config.maxPdfPages): Promise<{
  text: string;
  sections: PaperSection[];
  abstract: string;
  numPages: number;
}> {
  // PDF.js expects Uint8Array.slice() to copy; Buffer.slice() returns a view
  // and can corrupt parsing of otherwise valid PDFs. The legacy typings only
  // declare Buffer, although the underlying parser supports Uint8Array.
  const parseBytes = pdfParse as (data: Uint8Array, options: pdfParse.Options) => Promise<pdfParse.Result>;
  const result = await parseBytes(new Uint8Array(buffer), { max: maxPages });
  const text = result.text || "";
  const { sections, abstract } = splitSections(text);
  return { text, sections, abstract, numPages: result.numpages };
}

export async function paperIdFromFile(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return paperIdFromFileContents(buf);
}

export function paperIdFromFileContents(buf: Buffer): Promise<string> {
  return Promise.resolve(createHash("sha1").update(buf).digest("hex").slice(0, 16));
}

export async function paperIdFromArxiv(arxivId: string): Promise<string> {
  // Use the arxiv id directly so re-fetching is idempotent.
  return `arxiv:${arxivId.replace(/v\d+$/, "")}`;
}

export function buildMetadata(args: {
  id: string;
  arxivId?: string;
  title: string;
  authors: string[];
  abstract: string;
  source: PaperMetadata["source"];
  sourceUrl?: string;
  pdfPath?: string;
  sections: PaperSection[];
  numPages?: number;
}): PaperMetadata {
  return {
    id: args.id,
    arxivId: args.arxivId,
    title: args.title,
    authors: args.authors,
    abstract: args.abstract,
    publishedAt: undefined,
    sourceUrl: args.sourceUrl,
    pdfPath: args.pdfPath,
    source: args.source,
    ingestedAt: new Date().toISOString(),
    numPages: args.numPages,
    sections: args.sections.map((s) => ({ title: s.title, text: s.text })),
  };
}

export function buildFullText(paper: Paper): string {
  return paper.metadata.sections
    .filter((s) => s.title !== "References")
    .map((s) => `# ${s.title}\n\n${s.text}`)
    .join("\n\n");
}
