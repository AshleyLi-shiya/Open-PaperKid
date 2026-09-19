#!/usr/bin/env node
/**
 * CLI entrypoint for Open-PaperKid. The CLI uses the *environment* variables for
 * provider selection (LLM_BACKEND / OPENAI_API_KEY / ANTHROPIC_API_KEY / etc.),
 * which is the right shape for a local command. The Chrome extension sends
 * provider config per-request via headers instead.
 */
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  createClientFor,
  PROVIDERS,
  resolveProvider,
  type Provider,
} from "./services/llm.js";
import { downloadArxivPdf, searchArxiv } from "./services/arxiv.js";
import { buildFullText, buildMetadata, parsePdf } from "./services/pdfParser.js";
import { storage } from "./services/storage.js";
import { summarize } from "./services/summarize.js";
import { translate } from "./services/translate.js";
import { ask } from "./services/qa.js";
import { buildIndex } from "./services/rag.js";
import type { Paper } from "../../shared/types.js";

function hashBuffer(buf: Buffer): string {
  return createHash("sha1").update(buf).digest("hex").slice(0, 16);
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

/**
 * Resolve provider config from CLI flags, then env vars. CLI flags win.
 */
function resolveCliProvider(args: Record<string, string | boolean>) {
  const provider = ((args.provider as string) || process.env.LLM_BACKEND || "openai") as Provider;
  const apiKey =
    (args["api-key"] as string) ||
    (provider === "openai" && process.env.OPENAI_API_KEY) ||
    (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) ||
    (provider === "deepseek" && process.env.DEEPSEEK_API_KEY) ||
    (provider === "qwen" && process.env.QWEN_API_KEY) ||
    (provider === "kimi" && process.env.KIMI_API_KEY) ||
    (provider === "glm" && process.env.GLM_API_KEY) ||
    undefined;
  const baseUrl =
    (args["base-url"] as string) ||
    (provider === "deepseek" && process.env.DEEPSEEK_BASE_URL) ||
    (provider === "qwen" && process.env.QWEN_BASE_URL) ||
    (provider === "kimi" && process.env.KIMI_BASE_URL) ||
    (provider === "glm" && process.env.GLM_BASE_URL) ||
    (provider === "ollama" && (process.env.OLLAMA_BASE_URL || PROVIDERS.ollama.defaultBaseUrl)) ||
    undefined;
  const model =
    (args.model as string) ||
    (provider === "openai" && process.env.OPENAI_MODEL) ||
    (provider === "anthropic" && process.env.ANTHROPIC_MODEL) ||
    (provider === "deepseek" && process.env.DEEPSEEK_MODEL) ||
    (provider === "qwen" && process.env.QWEN_MODEL) ||
    (provider === "kimi" && process.env.KIMI_MODEL) ||
    (provider === "glm" && process.env.GLM_MODEL) ||
    (provider === "ollama" && process.env.OLLAMA_CHAT_MODEL) ||
    PROVIDERS[provider].recommendedModel;

  return resolveProvider({ provider, apiKey, baseUrl, model });
}

function makeCtx(args: Record<string, string | boolean>) {
  const resolved = resolveCliProvider(args);
  const client = createClientFor(resolved);
  return { resolved, client };
}

async function ingestPdfFile(pdfPath: string, title: string | undefined, ctx: ReturnType<typeof makeCtx>): Promise<string> {
  const buf = await fs.readFile(pdfPath);
  const id = hashBuffer(buf);
  const parsed = await parsePdf(buf);
  const metadata = buildMetadata({
    id,
    title: title || pdfPath,
    authors: [],
    abstract: parsed.abstract,
    source: "local",
    pdfPath,
    sections: parsed.sections,
    numPages: parsed.numPages,
  });
  const paper: Paper = { metadata, fullText: "" };
  paper.fullText = buildFullText(paper);
  await storage.writePaper(id, paper);
  try {
    await buildIndex(paper, ctx.client);
  } catch (e) {
    console.warn("Index build skipped:", (e as Error).message);
  }
  return id;
}

async function ingestArxiv(arxivId: string, title: string | undefined, ctx: ReturnType<typeof makeCtx>): Promise<string> {
  const { pdfPath, id, meta } = await downloadArxivPdf(arxivId);
  const buf = await fs.readFile(pdfPath);
  const parsed = await parsePdf(buf);
  const metadata = buildMetadata({
    id,
    arxivId: meta.arxivId,
    title: title || meta.title,
    authors: meta.authors,
    abstract: meta.abstract || parsed.abstract,
    source: "arxiv",
    sourceUrl: meta.pdfUrl,
    pdfPath,
    sections: parsed.sections,
    numPages: parsed.numPages,
  });
  const paper: Paper = { metadata, fullText: "" };
  paper.fullText = buildFullText(paper);
  await storage.writePaper(id, paper);
  try {
    await buildIndex(paper, ctx.client);
  } catch (e) {
    console.warn("Index build skipped:", (e as Error).message);
  }
  return id;
}

async function resolvePaperId(args: Record<string, string | boolean>, ctx: ReturnType<typeof makeCtx>): Promise<string> {
  if (typeof args.arxiv === "string") return ingestArxiv(args.arxiv, args.title as string | undefined, ctx);
  if (typeof args.pdf === "string") return ingestPdfFile(args.pdf, args.title as string | undefined, ctx);
  throw new Error("Provide --arxiv <id> or --pdf <path>");
}

async function cmdSummarize(args: Record<string, string | boolean>): Promise<void> {
  const ctx = makeCtx(args);
  if (PROVIDERS[ctx.resolved.provider].needsApiKey && !ctx.resolved.apiKey) {
    throw new Error(`${PROVIDERS[ctx.resolved.provider].label} requires an API key. Pass --api-key or set env var.`);
  }
  const id = await resolvePaperId(args, ctx);
  const lang = (args.lang as "zh" | "en" | "both") ?? "both";
  const result = await summarize(id, { paperId: id, language: lang }, {
    provider: ctx.resolved.provider,
    resolved: ctx.resolved,
    client: ctx.client,
  });
  console.log(JSON.stringify(result, null, 2));
}

async function cmdAsk(args: Record<string, string | boolean>): Promise<void> {
  if (typeof args.question !== "string") throw new Error("--question required");
  const ctx = makeCtx(args);
  if (PROVIDERS[ctx.resolved.provider].needsApiKey && !ctx.resolved.apiKey) {
    throw new Error(`${PROVIDERS[ctx.resolved.provider].label} requires an API key.`);
  }
  const id = await resolvePaperId(args, ctx);
  const result = await ask(id, { paperId: id, question: args.question, language: (args.lang as "zh" | "en") ?? "zh" }, {
    provider: ctx.resolved.provider,
    resolved: ctx.resolved,
    client: ctx.client,
  });
  console.log(JSON.stringify(result, null, 2));
}

async function cmdTranslate(args: Record<string, string | boolean>): Promise<void> {
  if (typeof args.target !== "string" || (args.target !== "zh" && args.target !== "en")) {
    throw new Error("--target must be zh or en");
  }
  const ctx = makeCtx(args);
  if (PROVIDERS[ctx.resolved.provider].needsApiKey && !ctx.resolved.apiKey) {
    throw new Error(`${PROVIDERS[ctx.resolved.provider].label} requires an API key.`);
  }
  const id = await resolvePaperId(args, ctx);
  const result = await translate(id, { paperId: id, targetLanguage: args.target }, {
    provider: ctx.resolved.provider,
    resolved: ctx.resolved,
    client: ctx.client,
  });
  console.log(JSON.stringify(result, null, 2));
}

async function cmdSearch(args: Record<string, string | boolean>): Promise<void> {
  if (typeof args.query !== "string") throw new Error("--query required");
  const max = args.max ? parseInt(args.max as string, 10) : 10;
  const results = await searchArxiv(args.query, max);
  console.log(JSON.stringify(results, null, 2));
}

async function cmdValidate(args: Record<string, string | boolean>): Promise<void> {
  const ctx = makeCtx(args);
  if (PROVIDERS[ctx.resolved.provider].needsApiKey && !ctx.resolved.apiKey) {
    console.error(`Provider ${ctx.resolved.provider} needs an API key.`);
    process.exit(1);
  }
  console.log(`Probing ${ctx.resolved.provider} (${ctx.resolved.model})…`);
  try {
    const t0 = Date.now();
    const out = await ctx.client.chat(
      [
        { role: "system", content: "Reply with the single word: OK" },
        { role: "user", content: "ping" },
      ],
      { temperature: 0, maxTokens: 8 }
    );
    console.log(`OK in ${Date.now() - t0}ms — response: ${JSON.stringify(out.slice(0, 32))}`);
  } catch (e) {
    console.error(`FAIL: ${(e as Error).message}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  await storage.init();
  const [, , cmd, ...rest] = process.argv;
  const args = parseArgs(rest);
  switch (cmd) {
    case "summarize":
      await cmdSummarize(args);
      break;
    case "ask":
      await cmdAsk(args);
      break;
    case "translate":
      await cmdTranslate(args);
      break;
    case "search":
      await cmdSearch(args);
      break;
    case "validate":
      await cmdValidate(args);
      break;
    default:
      console.log(`Usage:
  open-paperkid summarize --arxiv <id> [--lang zh|en|both] [--provider openai|anthropic|deepseek|qwen|kimi|glm|ollama] [--api-key sk-xxx] [--model gpt-4o-mini]
  open-paperkid summarize --pdf <path>  [--lang zh|en|both] [--provider ...] [--api-key ...] [--model ...]
  open-paperkid ask       --arxiv <id> --question "..." [--lang zh|en]
  open-paperkid ask       --pdf <path>  --question "..." [--lang zh|en]
  open-paperkid translate --arxiv <id>  --target zh|en
  open-paperkid translate --pdf  <path> --target zh|en
  open-paperkid search    --query "..." [--max 10]
  open-paperkid validate  --provider openai [--api-key sk-xxx]

Environment variables (alternative to CLI flags):
  LLM_BACKEND=openai|anthropic|deepseek|qwen|kimi|glm|ollama
  OPENAI_API_KEY, OPENAI_MODEL
  ANTHROPIC_API_KEY, ANTHROPIC_MODEL
  DEEPSEEK_API_KEY, DEEPSEEK_MODEL, DEEPSEEK_BASE_URL
  QWEN_API_KEY, QWEN_MODEL, QWEN_BASE_URL
  KIMI_API_KEY, KIMI_MODEL, KIMI_BASE_URL
  GLM_API_KEY, GLM_MODEL, GLM_BASE_URL
  OLLAMA_BASE_URL, OLLAMA_CHAT_MODEL, OLLAMA_EMBED_MODEL`);
  }
}

main().catch((e: unknown) => {
  console.error((e as Error).message);
  process.exit(1);
});