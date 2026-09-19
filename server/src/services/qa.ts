import type { AskRequest, AskResult, Paper } from "../../../shared/types.js";
import { qaPrompt } from "../prompts/index.js";
import { storage } from "./storage.js";
import { buildContextBlock, ensureIndexed, searchIndex } from "./rag.js";
import { truncateByTokens } from "../utils/chunk.js";
import type { ProviderContext } from "./providerContext.js";

export async function ask(paperId: string, req: AskRequest, ctx: ProviderContext): Promise<AskResult> {
  const paper = await storage.readPaper<Paper>(paperId);
  if (!paper) throw new Error(`Paper ${paperId} not found`);

  // Ensure RAG index exists using the user's chosen provider.
  // If embeddings aren't supported (e.g. Anthropic), fall back to abstract-only context.
  let retrieved: Awaited<ReturnType<typeof searchIndex>> = [];
  let indexOk = false;
  try {
    indexOk = await ensureIndexed(paperId, ctx.client);
  } catch (e) {
    indexOk = false;
  }

  if (indexOk) {
    const topK = req.topK ?? 6;
    retrieved = await searchIndex(paperId, req.question, ctx.client, topK);
  }

  const context =
    retrieved.length > 0
      ? buildContextBlock(retrieved)
      : `摘要(Abstract):\n${truncateByTokens(paper.metadata.abstract, 800)}\n\n说明:本次未启用向量检索(可能是嵌入模型不可用),回答仅基于摘要。`;

  const { system, user } = qaPrompt({ question: req.question, context, language: req.language });
  const answer = await ctx.client.chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.2, maxTokens: 800, model: ctx.resolved.model }
  );

  return {
    paperId,
    question: req.question,
    answer: answer.trim(),
    citations: retrieved.map((r) => ({ sectionTitle: r.sectionTitle ?? "未分类", snippet: truncateByTokens(r.text, 200) })),
  };
}