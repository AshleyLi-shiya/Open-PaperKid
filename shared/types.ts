// Shared types between server (Node) and chrome-extension (browser).
// Keep this file dependency-free.

export type Language = "zh" | "en" | "both";

export type LlmBackend = "ollama" | "openai" | "anthropic";

export interface PaperSection {
  title: string;
  text: string;
  // 0-based page range this section roughly covers, if known.
  pages?: [number, number];
}

export interface PaperMetadata {
  id: string;                // internal id (sha1 of pdf or arxiv id)
  arxivId?: string;
  title: string;
  authors: string[];
  abstract: string;
  publishedAt?: string;      // ISO date
  sourceUrl?: string;
  pdfPath?: string;          // local path if ingested from disk
  source: "arxiv" | "local" | "url";
  ingestedAt: string;        // ISO
  numPages?: number;
  sections: PaperSection[];
}

export interface Paper {
  metadata: PaperMetadata;
  // Full extracted plain text (joined sections). Capped to ~token budget.
  fullText: string;
}

export interface SummaryRequest {
  paperId: string;
  language: Language;        // "zh" | "en" | "both"
  // Override simple-language level if needed (defaults to ~grade 6).
  readingLevel?: "elementary" | "middle" | "high";
}

export interface SummaryResult {
  paperId: string;
  language: Language;
  // Map from language code to the summary text.
  summaries: Record<string, Summary>;
}

export interface Summary {
  oneLine: string;           // 一句话总结 / One-sentence summary
  keyPoints: string[];       // 5-7 关键点 / Key points
  // Four canonical questions (research background, prior work, method, results).
  background: string;
  priorWork: string;
  method: string;
  results: string;
  // Optional caveats the user should verify themselves.
  verifyNumbers?: string[];
}

export interface TranslateRequest {
  paperId: string;
  targetLanguage: "zh" | "en";
  // If undefined, translate whole document in section order.
  sectionTitles?: string[];
}

export interface TranslateResult {
  paperId: string;
  targetLanguage: "zh" | "en";
  sections: { title: string; translated: string }[];
}

export interface AskRequest {
  paperId: string;
  question: string;
  language: "zh" | "en";
  // Top-k chunks to retrieve before answering.
  topK?: number;
}

export interface AskResult {
  paperId: string;
  question: string;
  answer: string;
  citations: { sectionTitle: string; snippet: string }[];
}

// API request bodies (server-side)
export interface IngestLocalPdfRequest {
  // Absolute path on the server's filesystem.
  filePath: string;
  arxivId?: string;
  title?: string;
}

export interface FetchArxivRequest {
  arxivId: string;
}

export interface ServerConfig {
  port: number;
  llm: {
    backend: LlmBackend;
    // For ollama
    ollamaBaseUrl?: string;
    chatModel?: string;
    translateModel?: string;
    embedModel?: string;
    // For openai / anthropic (BYOK)
    apiKey?: string;
  };
  storageDir: string;
  maxPdfPages: number;
  maxChunkTokens: number;
}