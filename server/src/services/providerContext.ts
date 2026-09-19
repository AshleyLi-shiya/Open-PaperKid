// Request-scoped helpers to extract provider config from HTTP headers.
// All callers must go through this so we have ONE place to sanitize keys.

import type { Request } from "express";
import {
  createClientFor,
  resolveProvider,
  type LlmClient,
  type Provider,
  type ResolvedProvider,
} from "./llm.js";

export interface ProviderContext {
  provider: Provider;
  resolved: ResolvedProvider;
  client: LlmClient;
}

export function providerFromRequest(req: Request): ProviderContext {
  const provider = (req.header("x-paperkid-provider") || "openai").toLowerCase() as Provider;
  const apiKey = req.header("x-paperkid-api-key") || undefined;
  const baseUrl = req.header("x-paperkid-base-url") || undefined;
  const model = req.header("x-paperkid-model") || undefined;
  const resolved = resolveProvider({ provider, apiKey, baseUrl, model });
  const client = createClientFor(resolved);
  return { provider, resolved, client };
}

/**
 * Sanitize an LLM error so we never log API keys.
 */
export function safeErrorMessage(e: unknown): string {
  const msg = (e as Error)?.message ?? String(e);
  return msg
    .replace(/sk-[A-Za-z0-9_\-]{8,}/g, "sk-***")
    .replace(/sk-ant-[A-Za-z0-9_\-]{8,}/g, "sk-ant-***")
    .replace(/x-api-key:.*/gi, "x-api-key: ***")
    .replace(/Bearer\s+[A-Za-z0-9_\-\.]{8,}/g, "Bearer ***");
}