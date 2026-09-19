import type { LlmBackend, ServerConfig } from "../../shared/types.js";

function envOrDefault(key: string, fallback: string): string {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}

function envIntOrDefault(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return n;
}

/**
 * Server-side config. Most LLM settings are now per-request (sent via
 * X-Paperkid-* headers from the Chrome extension). The env vars below
 * are CLI fallbacks and used only for the server itself.
 */
export const config: ServerConfig = {
  port: envIntOrDefault("PORT", 5174),
  llm: {
    backend: envOrDefault("LLM_BACKEND", "openai") as LlmBackend,
    // Per-request model + key are read from request headers; these are CLI fallbacks.
    chatModel: envOrDefault("OPENAI_MODEL", "gpt-4o-mini"),
    translateModel: envOrDefault("OPENAI_MODEL", "gpt-4o-mini"),
    embedModel: envOrDefault("OLLAMA_EMBED_MODEL", "nomic-embed-text"),
    ollamaBaseUrl: envOrDefault("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
    apiKey: process.env.OPENAI_API_KEY || undefined,
  },
  storageDir: envOrDefault("STORAGE_DIR", "./.open-paperkid-data"),
  maxPdfPages: envIntOrDefault("MAX_PDF_PAGES", 40),
  maxChunkTokens: envIntOrDefault("MAX_CHUNK_TOKENS", 800),
};