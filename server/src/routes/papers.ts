import { Router } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { buildFullText, buildMetadata, paperIdFromFile, paperIdFromFileContents, parsePdf } from "../services/pdfParser.js";
import { downloadArxivPdf, fetchArxivMeta, searchArxiv } from "../services/arxiv.js";
import { storage } from "../services/storage.js";
import { summarize } from "../services/summarize.js";
import { translate } from "../services/translate.js";
import { ask } from "../services/qa.js";
import { buildIndex, clearIndexes } from "../services/rag.js";
import { PROVIDERS, PROVIDER_ORDER, validateProvider } from "../services/llm.js";
import { providerFromRequest, safeErrorMessage } from "../services/providerContext.js";
import type { Paper, SummaryRequest, TranslateRequest, AskRequest } from "../../../shared/types.js";

export const papersRouter = Router();

interface IngestLocalRequest {
  filePath: string;
  arxivId?: string;
  title?: string;
}

papersRouter.get("/providers", (_req, res) => {
  res.json({
    providers: PROVIDER_ORDER.map((id) => {
      const p = PROVIDERS[id];
      return {
        id,
        label: p.label,
        description: p.description,
        needsApiKey: p.needsApiKey,
        recommendedModel: p.recommendedModel,
        defaultBaseUrl: p.defaultBaseUrl,
        suggestedModels: p.suggestedModels,
      };
    }),
  });
});

papersRouter.post("/providers/validate", async (req, res) => {
  try {
    const ctx = providerFromRequest(req);
    const result = await validateProvider(ctx.resolved);
    res.json({
      provider: ctx.provider,
      model: ctx.resolved.model,
      ...result,
    });
  } catch (e: unknown) {
    res.status(500).json({ error: safeErrorMessage(e) });
  }
});

papersRouter.post("/papers/fetch", async (req, res) => {
  const { arxivId } = req.body as { arxivId?: string };
  if (!arxivId) return res.status(400).json({ error: "arxivId required" });
  try {
    const meta = await fetchArxivMeta(arxivId);
    res.json({ meta });
  } catch (e: unknown) {
    res.status(500).json({ error: safeErrorMessage(e) });
  }
});

papersRouter.post("/papers/search", async (req, res) => {
  const { query, maxResults } = req.body as { query?: string; maxResults?: number };
  if (!query) return res.status(400).json({ error: "query required" });
  try {
    const results = await searchArxiv(query, maxResults ?? 10);
    res.json({ results });
  } catch (e: unknown) {
    res.status(500).json({ error: safeErrorMessage(e) });
  }
});

async function ingestArxivPaper(arxivId: string, titleOverride?: string) {
  const { pdfPath, id, meta } = await downloadArxivPdf(arxivId);
  const buf = await fs.readFile(pdfPath);
  const parsed = await parsePdf(buf);
  const metadata = buildMetadata({
    id,
    arxivId: meta.arxivId,
    title: titleOverride || meta.title,
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
  clearIndexes(id);
  return paper;
}

async function ingestLocalFile(absPath: string, titleOverride?: string) {
  const buf = await fs.readFile(absPath);
  const id = await paperIdFromFile(absPath);
  const parsed = await parsePdf(buf);
  const metadata = buildMetadata({
    id,
    title: titleOverride || path.basename(absPath, path.extname(absPath)),
    authors: [],
    abstract: parsed.abstract,
    source: "local",
    pdfPath: absPath,
    sections: parsed.sections,
    numPages: parsed.numPages,
  });
  const paper: Paper = { metadata, fullText: "" };
  paper.fullText = buildFullText(paper);
  await storage.writePaper(id, paper);
  clearIndexes(id);
  return paper;
}

papersRouter.post("/papers/ingest", async (req, res) => {
  const body = req.body as IngestLocalRequest & { arxivId?: string };
  try {
    let paper: Paper;
    if (body.arxivId) {
      paper = await ingestArxivPaper(body.arxivId, body.title);
    } else if (body.filePath) {
      paper = await ingestLocalFile(path.resolve(body.filePath), body.title);
    } else {
      return res.status(400).json({ error: "either arxivId or filePath required" });
    }
    // Index for Q&A using the user's provider (best-effort: skip on embed error).
    try {
      const ctx = providerFromRequest(req);
      await buildIndex(paper, ctx.client);
    } catch (e) {
      // Don't fail ingest just because embeddings aren't available.
      console.warn("Index build skipped:", safeErrorMessage(e));
    }
    return res.json({ paper: paper.metadata });
  } catch (e: unknown) {
    return res.status(500).json({ error: safeErrorMessage(e) });
  }
});

papersRouter.post("/papers/ingest-local-upload", async (req, res) => {
  const { filename, b64, title } = req.body as { filename?: string; b64?: string; title?: string };
  if (!b64 || !filename) return res.status(400).json({ error: "filename and b64 required" });
  try {
    const buf = Buffer.from(b64, "base64");
    const id = await paperIdFromFileContents(buf);
    const pdfPath = storage.pdfPath(id);
    await fs.writeFile(pdfPath, buf);
    const parsed = await parsePdf(buf);
    const metadata = buildMetadata({
      id,
      title: title || filename,
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
    clearIndexes(id);
    try {
      const ctx = providerFromRequest(req);
      await buildIndex(paper, ctx.client);
    } catch (e) {
      console.warn("Index build skipped:", safeErrorMessage(e));
    }
    res.json({ paper: paper.metadata });
  } catch (e: unknown) {
    res.status(500).json({ error: safeErrorMessage(e) });
  }
});

papersRouter.get("/papers", async (_req, res) => {
  const ids = await storage.listPapers();
  const papers = await Promise.all(
    ids.map(async (id) => {
      const p = await storage.readPaper<Paper>(id);
      return p?.metadata ?? null;
    })
  );
  res.json({ papers: papers.filter(Boolean) });
});

papersRouter.get("/papers/:id", async (req, res) => {
  const paper = await storage.readPaper<Paper>(req.params.id);
  if (!paper) return res.status(404).json({ error: "not found" });
  res.json({ paper });
});

papersRouter.delete("/papers/:id", async (req, res) => {
  try {
    await storage.deletePaper(req.params.id);
    clearIndexes(req.params.id);
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: safeErrorMessage(e) });
  }
});

papersRouter.post("/papers/:id/summarize", async (req, res) => {
  const body = req.body as Partial<SummaryRequest>;
  try {
    const ctx = providerFromRequest(req);
    const result = await summarize(req.params.id, {
      paperId: req.params.id,
      language: body.language ?? "both",
      readingLevel: body.readingLevel,
    }, ctx);
    res.json(result);
  } catch (e: unknown) {
    res.status(500).json({ error: safeErrorMessage(e) });
  }
});

papersRouter.post("/papers/:id/translate", async (req, res) => {
  const body = req.body as Partial<TranslateRequest>;
  try {
    const ctx = providerFromRequest(req);
    const result = await translate(req.params.id, {
      paperId: req.params.id,
      targetLanguage: body.targetLanguage ?? "zh",
      sectionTitles: body.sectionTitles,
    }, ctx);
    res.json(result);
  } catch (e: unknown) {
    res.status(500).json({ error: safeErrorMessage(e) });
  }
});

papersRouter.post("/papers/:id/ask", async (req, res) => {
  const body = req.body as Partial<AskRequest>;
  if (typeof body.question !== "string" || !body.question.trim() || body.question.length > 4000) return res.status(400).json({ error: "question must contain 1–4000 characters" });
  if (body.history !== undefined && (!Array.isArray(body.history) || body.history.length > 6 || body.history.some(m => !m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 4000))) return res.status(400).json({ error: "history must contain at most 6 user/assistant messages of up to 4000 characters" });
  if (body.topK !== undefined && (!Number.isInteger(body.topK) || body.topK < 1 || body.topK > 10)) return res.status(400).json({ error: "topK must be an integer from 1 to 10" });
  try {
    const ctx = providerFromRequest(req);
    const result = await ask(req.params.id, {
      paperId: req.params.id,
      question: body.question,
      language: body.language ?? "zh",
      topK: body.topK,
      history: body.history,
    }, ctx);
    res.json(result);
  } catch (e: unknown) {
    res.status(500).json({ error: safeErrorMessage(e) });
  }
});
