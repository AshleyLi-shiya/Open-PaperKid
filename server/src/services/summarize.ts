import type { Paper, Summary, SummaryRequest, SummaryResult } from "../../../shared/types.js";
import { summaryPrompt } from "../prompts/index.js";
import { storage } from "./storage.js";
import { targetLangs } from "../utils/language.js";
import { truncateByTokens } from "../utils/chunk.js";
import type { ProviderContext } from "./providerContext.js";

function findSection(paper: Paper, name: string): string {
  const target = name.toLowerCase();
  const sec = paper.metadata.sections.find((s) => s.title.toLowerCase().includes(target));
  return sec ? truncateByTokens(sec.text, 1500) : "";
}

function safeParseJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new Error(`Failed to parse summary JSON: ${cleaned.slice(0, 200)}…`);
  }
}

function coerceSummary(raw: unknown): Summary {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    oneLine: String(r.oneLine ?? ""),
    keyPoints: Array.isArray(r.keyPoints) ? r.keyPoints.map((x) => String(x)) : [],
    background: String(r.background ?? ""),
    priorWork: String(r.priorWork ?? r.prior_work ?? ""),
    method: String(r.method ?? ""),
    results: String(r.results ?? ""),
    verifyNumbers: Array.isArray(r.verifyNumbers) ? r.verifyNumbers.map((x) => String(x)) : undefined,
  };
}

export async function summarize(paperId: string, req: SummaryRequest, ctx: ProviderContext): Promise<SummaryResult> {
  const paper = await storage.readPaper<Paper>(paperId);
  if (!paper) throw new Error(`Paper ${paperId} not found`);

  const langs = targetLangs(req.language);
  const summaries: Record<string, Summary> = {};

  const args = {
    title: paper.metadata.title,
    abstract: paper.metadata.abstract,
    intro: findSection(paper, "Introduction") || truncateByTokens(paper.fullText, 1500),
    method: findSection(paper, "Method"),
    experiments: findSection(paper, "Experiments"),
    conclusion: findSection(paper, "Conclusion"),
  };

  for (const lang of langs) {
    const { system, user } = summaryPrompt({ ...args, language: lang });
    const raw = await ctx.client.chat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { json: true, temperature: 0.2, model: ctx.resolved.model }
    );
    summaries[lang] = coerceSummary(safeParseJson(raw));
  }

  return { paperId, language: req.language, summaries };
}
