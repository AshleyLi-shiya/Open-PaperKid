import type { Language } from "../../../shared/types.js";

export function targetLangs(language: Language): ("zh" | "en")[] {
  if (language === "both") return ["zh", "en"];
  return [language];
}

/**
 * Heuristic CJK ratio check.
 */
export function detectLang(text: string): "zh" | "en" {
  let cjk = 0;
  for (const ch of text) {
    if (/[　-鿿]/.test(ch)) cjk++;
  }
  return cjk / text.length > 0.1 ? "zh" : "en";
}