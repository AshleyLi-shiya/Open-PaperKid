import type { Paper, TranslateRequest, TranslateResult } from "../../../shared/types.js";
import { translatePrompt } from "../prompts/index.js";
import { storage } from "./storage.js";
import type { ProviderContext } from "./providerContext.js";

const MAX_SECTION_CHARS = 6000;

export async function translate(paperId: string, req: TranslateRequest, ctx: ProviderContext): Promise<TranslateResult> {
  const paper = await storage.readPaper<Paper>(paperId);
  if (!paper) throw new Error(`Paper ${paperId} not found`);

  const target = req.targetLanguage;
  const wantedSections = req.sectionTitles
    ? paper.metadata.sections.filter((s) => req.sectionTitles!.some((t) => s.title.toLowerCase() === t.toLowerCase()))
    : paper.metadata.sections.filter((s) => s.title !== "References");

  const out: TranslateResult["sections"] = [];

  for (const sec of wantedSections) {
    const text = sec.text;
    const pieces: string[] = [];
    if (text.length <= MAX_SECTION_CHARS) {
      pieces.push(text);
    } else {
      for (let i = 0; i < text.length; i += MAX_SECTION_CHARS) {
        pieces.push(text.slice(i, i + MAX_SECTION_CHARS));
      }
    }

    const translatedPieces: string[] = [];
    for (let i = 0; i < pieces.length; i++) {
      const ctxText = `${paper.metadata.title} — ${sec.title}` + (pieces.length > 1 ? ` (part ${i + 1}/${pieces.length})` : "");
      const { system, user } = translatePrompt({ text: pieces[i], targetLanguage: target, context: ctxText });
      const outText = await ctx.client.chat(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        { temperature: 0.2, maxTokens: Math.max(1024, Math.min(4096, pieces[i].length)), model: ctx.resolved.model }
      );
      translatedPieces.push(outText.trim());
    }

    out.push({
      title: sec.title,
      translated: translatedPieces.join("\n\n"),
    });
  }

  return { paperId, targetLanguage: target, sections: out };
}