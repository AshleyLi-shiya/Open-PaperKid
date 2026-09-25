import { config } from "../config.js";

/**
 * Approximate tokenizer-free chunker based on character/paragraph boundaries.
 * We avoid pulling tiktoken to keep the server dependency-light.
 *
 * The target ~maxChunkTokens is treated as ~chars (a token is roughly 4 chars
 * in English, ~1.5 chars in CJK). We bias toward 1.5x to be safe.
 */

function estimateTokens(s: string): number {
  // Count CJK chars as ~1 token, others as ~1/4 token (rough average).
  let cjk = 0;
  for (const ch of s) {
    if (/[　-鿿]/.test(ch)) cjk++;
  }
  const others = s.length - cjk;
  return Math.ceil(cjk + others / 4);
}

export interface Chunk {
  text: string;
  index: number;
  // Section the chunk belongs to (best-effort).
  sectionTitle?: string;
}

export function chunkText(text: string, opts: { sectionTitle?: string; maxTokens?: number } = {}): Chunk[] {
  const maxTokens = opts.maxTokens ?? config.maxChunkTokens;
  const paragraphs = text.split(/\n\s*\n+/);
  const chunks: Chunk[] = [];
  let buffer = "";
  let bufTokens = 0;

  const flush = () => {
    const t = buffer.trim();
    if (t.length === 0) return;
    chunks.push({ text: t, index: chunks.length, sectionTitle: opts.sectionTitle });
    buffer = "";
    bufTokens = 0;
  };

  for (const p of paragraphs) {
    const pt = p.trim();
    if (!pt) continue;
    const ptTokens = estimateTokens(pt);
    if (ptTokens > maxTokens) {
      flush();
      // Hard-split very long paragraphs by sentences.
      const sentences = pt.split(/(?<=[.!?。！？])\s+/);
      let subBuf = "";
      let subTokens = 0;
      for (const s of sentences) {
        const st = s.trim();
        if (!st) continue;
        const stTokens = estimateTokens(st);
        if (subTokens + stTokens > maxTokens) {
          if (subBuf) {
            chunks.push({ text: subBuf.trim(), index: chunks.length, sectionTitle: opts.sectionTitle });
            subBuf = "";
            subTokens = 0;
          }
          if (stTokens > maxTokens) {
            // Last resort: hard-cut.
            const stride = maxTokens;
            for (let i = 0; i < st.length; i += stride) {
              chunks.push({
                text: st.slice(i, i + stride),
                index: chunks.length,
                sectionTitle: opts.sectionTitle,
              });
            }
          } else {
            subBuf = st;
            subTokens = stTokens;
          }
        } else {
          subBuf += (subBuf ? " " : "") + st;
          subTokens += stTokens;
        }
      }
      if (subBuf) {
        chunks.push({ text: subBuf.trim(), index: chunks.length, sectionTitle: opts.sectionTitle });
      }
      continue;
    }
    if (bufTokens + ptTokens > maxTokens) flush();
    buffer += (buffer ? "\n\n" : "") + pt;
    bufTokens += ptTokens;
  }
  flush();
  return chunks;
}

export function truncateByTokens(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) return text;
  // Reserve room for the ellipsis; handle CJK instead of assuming 4 chars/token.
  let low = 0;
  let high = text.length;
  const budget = Math.max(0, maxTokens - 1);
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (estimateTokens(text.slice(0, mid)) <= budget) low = mid;
    else high = mid - 1;
  }
  return text.slice(0, low) + "…";
}
