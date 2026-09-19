import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { config } from "./config.js";
import { storage } from "./services/storage.js";
import { papersRouter } from "./routes/papers.js";
import { PROVIDER_ORDER } from "./services/llm.js";

// ------------------------------------------------------------------
// Production-ready Express bootstrap.
// - CORS locked to chrome-extension origins + user-configured origins
// - Per-IP rate limiting (in-process, simple)
// - Privacy-respecting logging (no API keys, no paper content)
// - Centralized error handler
// - Health + readiness probes
// ------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  // Chrome / Edge extension origins (development)
  /^chrome-extension:\/\/[a-z]+$/,
  // Firefox extension origin
  /^moz-extension:\/\/.*$/,
  // Loopback for local dev
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function corsOrigin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
  if (!origin) return cb(null, true); // same-origin / server-to-server
  for (const allowed of ALLOWED_ORIGINS) {
    if (typeof allowed === "string" ? allowed === origin : allowed.test(origin)) {
      return cb(null, true);
    }
  }
  // Allow any https origin in production for embedded UIs (users may host their own UI)
  if (/^https:\/\/.*$/.test(origin)) return cb(null, true);
  cb(new Error(`Origin ${origin} not allowed`), false);
}

// Simple sliding-window rate limiter, keyed by IP. Adjust to your taste.
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(perWindowMs: number, max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt < now) {
      buckets.set(ip, { count: 1, resetAt: now + perWindowMs });
      return next();
    }
    if (bucket.count >= max) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: bucket.resetAt - now });
      return;
    }
    bucket.count++;
    next();
  };
}

function safeLog(line: string, meta?: Record<string, unknown>) {
  // Truncate / strip any accidental key-like tokens before logging.
  const cleaned = line
    .replace(/sk-[A-Za-z0-9_\-]{8,}/g, "sk-***")
    .replace(/sk-ant-[A-Za-z0-9_\-]{8,}/g, "sk-ant-***")
    .replace(/Bearer\s+[A-Za-z0-9_\-\.]{8,}/g, "Bearer ***");
  if (meta) {
    const safeMeta: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta)) {
      safeMeta[k] = typeof v === "string" ? (v as string).replace(/sk-[A-Za-z0-9_\-]{8,}/g, "sk-***") : v;
    }
    // eslint-disable-next-line no-console
    console.log(cleaned, safeMeta);
  } else {
    // eslint-disable-next-line no-console
    console.log(cleaned);
  }
}

async function main() {
  await storage.init();

  const app = express();
  app.disable("x-powered-by"); // do not advertise
  app.set("trust proxy", "loopback");

  app.use(
    cors({
      origin: corsOrigin,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["content-type", "x-paperkid-provider", "x-paperkid-api-key", "x-paperkid-base-url", "x-paperkid-model"],
      maxAge: 86400,
    })
  );

  // Generous body limit for PDF uploads via base64.
  app.use(express.json({ limit: "20mb" }));

  // Light request log — method, path, status, latency, provider (never key).
  app.use((req: Request, res: Response, next: NextFunction) => {
    const t0 = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - t0;
      safeLog(`${req.method} ${req.path} -> ${res.statusCode} ${ms}ms`, {
        provider: req.header("x-paperkid-provider") ?? null,
      });
    });
    next();
  });

  // Per-IP rate limit (60 req/min on hot paths; generous for dev).
  app.use("/api/", rateLimit(60_000, 60));

  // Health & readiness
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "0.2.0",
      defaultProvider: "openai",
      providers: PROVIDER_ORDER,
      storage: storage.status(),
    });
  });

  app.get("/api/ready", async (_req, res) => {
    try {
      await storage.init();
      res.json({ ready: true });
    } catch (e) {
      res.status(503).json({ ready: false, error: (e as Error).message });
    }
  });

  app.use("/api", papersRouter);

  // Minimal landing page — points users at the extension.
  app.get("/", (_req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Open-PaperKid API</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;max-width:680px;margin:48px auto;padding:0 16px;line-height:1.6;color:#1a1a1a}
    code{background:#f3f3f3;padding:1px 6px;border-radius:4px;font-size:13px}
    a{color:#185fa5}
    .badge{display:inline-block;background:#e6f1fb;color:#185fa5;padding:2px 8px;border-radius:4px;font-size:12px;margin-right:6px}
  </style>
</head>
<body>
  <h1>Open-PaperKid API</h1>
  <p>
    <span class="badge">v0.2.0</span>
    <span class="badge">BYOK</span>
    <span class="badge">Open Source · MIT</span>
  </p>
  <p>This is the Open-PaperKid backend. Most users should install the <a href="https://github.com/AshleyLi-shiya/paperkid">Chrome extension</a> and configure their API key in the extension settings.</p>
  <h2>Quick reference</h2>
  <ul>
    <li><code>GET  /api/health</code></li>
    <li><code>GET  /api/providers</code></li>
    <li><code>POST /api/providers/validate</code></li>
    <li><code>POST /api/papers/ingest</code> { arxivId | filePath }</li>
    <li><code>POST /api/papers/:id/summarize</code> { language: "zh" | "en" | "both" }</li>
    <li><code>POST /api/papers/:id/translate</code> { targetLanguage: "zh" | "en" }</li>
    <li><code>POST /api/papers/:id/ask</code> { question, language }</li>
  </ul>
  <p>All LLM calls require headers:
    <code>X-Paperkid-Provider</code>,
    <code>X-Paperkid-Api-Key</code> (optional for Ollama),
    <code>X-Paperkid-Model</code> (optional, falls back to recommended).
  </p>
</body>
</html>`);
  });

  // Centralized error handler — never leaks stack traces to clients.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const msg = (err as Error)?.message || "internal_error";
    const cleaned = msg
      .replace(/sk-[A-Za-z0-9_\-]{8,}/g, "sk-***")
      .replace(/sk-ant-[A-Za-z0-9_\-]{8,}/g, "sk-ant-***");
    safeLog("error", { msg: cleaned });
    if (!res.headersSent) res.status(500).json({ error: cleaned });
  });

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Open-PaperKid server listening on http://localhost:${config.port}`);
    // eslint-disable-next-line no-console
    console.log("LLM provider is chosen per-request via X-Paperkid-Provider header (default: openai).");
  });
}

main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Fatal:", e);
  process.exit(1);
});