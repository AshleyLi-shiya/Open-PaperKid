// Multi-provider LLM client. Default = OpenAI (BYOK).
//
// BYOK design:
// - API key comes from the X-Paperkid-Api-Key request header (sent by the
//   Chrome extension from chrome.storage.local).
// - Provider comes from X-Paperkid-Provider.
// - Model is X-Paperkid-Model (falls back to a recommended default per
//   provider).
// - Base URL is X-Paperkid-Base-Url (used by Ollama / self-hosted proxies).
// - The server NEVER persists the key, NEVER logs it, and NEVER writes it
//   to disk. Each call is stateless.

export type Provider =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "qwen"
  | "kimi"
  | "glm"
  | "ollama";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  model?: string;
}

export interface ProviderSpec {
  id: Provider;
  label: string;
  recommendedModel: string;
  description: string;
  needsApiKey: boolean;
  defaultBaseUrl?: string;
  /** Models suggested by us. The user can override via X-Paperkid-Model. */
  suggestedModels?: string[];
}

export const PROVIDERS: Record<Provider, ProviderSpec> = {
  openai: {
    id: "openai",
    label: "OpenAI (ChatGPT)",
    recommendedModel: "gpt-4o-mini",
    description: "Best overall quality for English papers. Needs an OpenAI API key.",
    needsApiKey: true,
    suggestedModels: ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "o4-mini", "o3"],
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    recommendedModel: "claude-3-5-sonnet-latest",
    description: "Strong reasoning and long-context understanding.",
    needsApiKey: true,
    suggestedModels: [
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-3-opus-latest",
    ],
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    recommendedModel: "deepseek-chat",
    description: "Cheap and good for Chinese papers. OpenAI-compatible API.",
    needsApiKey: true,
    defaultBaseUrl: "https://api.deepseek.com/v1",
    suggestedModels: ["deepseek-chat", "deepseek-reasoner"],
  },
  qwen: {
    id: "qwen",
    label: "通义千问 (Qwen)",
    recommendedModel: "qwen-plus-latest",
    description: "Alibaba Qwen, strong Chinese paper understanding. Use a DashScope API key.",
    needsApiKey: true,
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    suggestedModels: ["qwen-plus-latest", "qwen-turbo-latest", "qwen-max-latest"],
  },
  kimi: {
    id: "kimi",
    label: "Kimi (Moonshot)",
    recommendedModel: "moonshot-v1-8k",
    description: "Moonshot Kimi, long-context friendly for Chinese and English papers.",
    needsApiKey: true,
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    suggestedModels: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
  },
  glm: {
    id: "glm",
    label: "智谱 GLM",
    recommendedModel: "glm-4-flash",
    description: "Zhipu GLM, cost-effective Chinese reasoning. Use an Open Platform API key.",
    needsApiKey: true,
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    suggestedModels: ["glm-4-flash", "glm-4", "glm-4-air"],
  },
  ollama: {
    id: "ollama",
    label: "Ollama (本地模型)",
    recommendedModel: "qwen2.5:7b",
    description: "Fully local, zero cost. Needs Ollama running on your machine.",
    needsApiKey: false,
    defaultBaseUrl: "http://127.0.0.1:11434",
    suggestedModels: ["qwen2.5:7b", "qwen2.5:14b", "llama3.1:8b", "mistral:7b"],
  },
};

export const PROVIDER_ORDER: Provider[] = [
  "openai",
  "anthropic",
  "deepseek",
  "qwen",
  "kimi",
  "glm",
  "ollama",
];

export interface ResolvedProvider {
  provider: Provider;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export interface LlmClient {
  readonly embeddingKey: string;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
  embed(texts: string[]): Promise<number[][]>;
}

export function resolveProvider(req: {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): ResolvedProvider {
  const raw = (req.provider || "openai").toLowerCase() as Provider;
  const provider: Provider = (PROVIDERS[raw] ? raw : "openai");
  const spec = PROVIDERS[provider];
  return {
    provider,
    apiKey: req.apiKey || undefined,
    baseUrl: req.baseUrl || spec.defaultBaseUrl,
    model: req.model || spec.recommendedModel,
  };
}

export function createClientFor(resolved: ResolvedProvider): LlmClient {
  switch (resolved.provider) {
    case "openai":
      return new OpenAICompatClient({
        baseUrl: resolved.baseUrl || "https://api.openai.com/v1",
        apiKey: resolved.apiKey || "",
        model: resolved.model,
      });
    case "deepseek":
      return new OpenAICompatClient({
        baseUrl: resolved.baseUrl || "https://api.deepseek.com/v1",
        apiKey: resolved.apiKey || "",
        model: resolved.model,
      });
    case "qwen":
      return new OpenAICompatClient({
        baseUrl: resolved.baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1",
        apiKey: resolved.apiKey || "",
        model: resolved.model,
      });
    case "kimi":
      return new OpenAICompatClient({
        baseUrl: resolved.baseUrl || "https://api.moonshot.cn/v1",
        apiKey: resolved.apiKey || "",
        model: resolved.model,
      });
    case "glm":
      return new OpenAICompatClient({
        baseUrl: resolved.baseUrl || "https://open.bigmodel.cn/api/paas/v4",
        apiKey: resolved.apiKey || "",
        model: resolved.model,
      });
    case "anthropic":
      return new AnthropicClient({
        apiKey: resolved.apiKey || "",
        model: resolved.model,
      });
    case "ollama":
      return new OllamaClient({
        baseUrl: resolved.baseUrl || "http://127.0.0.1:11434",
        chat: resolved.model,
        embed: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
      });
  }
}

class OpenAICompatClient implements LlmClient {
  constructor(private opts: { baseUrl: string; apiKey: string; model: string }) {}
  get embeddingKey(): string { return JSON.stringify(["openai-compatible", this.opts.baseUrl, "text-embedding-3-small"]); }

  async chat(messages: ChatMessage[], o: ChatOptions = {}): Promise<string> {
    const res = await fetch(`${this.opts.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.opts.apiKey ? { authorization: `Bearer ${this.opts.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: o.model || this.opts.model,
        messages,
        temperature: o.temperature ?? 0.3,
        max_tokens: o.maxTokens ?? 1024,
        ...(o.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) throw new LlmHttpError(res.status, await res.text(), "openai-compat");
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Only OpenAI supports embeddings on this client.
    if (!this.opts.apiKey) {
      throw new Error("Embedding requires an API key. Use Ollama for local embeddings, or provide an OpenAI key.");
    }
    const res = await fetch(`${this.opts.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
    });
    if (!res.ok) throw new LlmHttpError(res.status, await res.text(), "openai-embed");
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data.map((d) => d.embedding);
  }
}

class AnthropicClient implements LlmClient {
  constructor(private opts: { apiKey: string; model: string }) {}
  readonly embeddingKey = "anthropic:no-embeddings";

  async chat(messages: ChatMessage[], o: ChatOptions = {}): Promise<string> {
    if (!this.opts.apiKey) throw new Error("Anthropic provider requires an API key.");
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const rest = messages.filter((m) => m.role !== "system");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.opts.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: o.model || this.opts.model,
        system,
        messages: rest.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: o.maxTokens ?? 1024,
        temperature: o.temperature ?? 0.3,
      }),
    });
    if (!res.ok) throw new LlmHttpError(res.status, await res.text(), "anthropic");
    const data = (await res.json()) as { content?: { text?: string }[] };
    return data.content?.[0]?.text ?? "";
  }

  async embed(_texts: string[]): Promise<number[][]> {
    throw new Error("Anthropic has no hosted embedding model. Use Ollama for local embeddings, or provide an OpenAI key.");
  }
}

class OllamaClient implements LlmClient {
  constructor(private opts: { baseUrl: string; chat: string; embed: string }) {}
  get embeddingKey(): string { return JSON.stringify(["ollama", this.opts.baseUrl, this.opts.embed]); }

  async chat(messages: ChatMessage[], o: ChatOptions = {}): Promise<string> {
    const model = o.model || this.opts.chat;
    const res = await fetch(`${this.opts.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: o.temperature ?? 0.3,
          num_predict: o.maxTokens ?? 1024,
        },
        format: o.json ? "json" : undefined,
      }),
    });
    if (!res.ok) throw new LlmHttpError(res.status, await res.text(), "ollama-chat");
    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content ?? "";
  }

  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (const t of texts) {
      const res = await fetch(`${this.opts.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: this.opts.embed, prompt: t }),
      });
      if (!res.ok) throw new LlmHttpError(res.status, await res.text(), "ollama-embed");
      const data = (await res.json()) as { embedding: number[] };
      out.push(data.embedding);
    }
    return out;
  }
}

export class LlmHttpError extends Error {
  constructor(public status: number, public body: string, public provider: string) {
    // Truncate the body to avoid leaking keys in our logs.
    const safeBody = body.replace(/sk-[A-Za-z0-9_\-]+/g, "sk-***").slice(0, 300);
    super(`LLM call to ${provider} failed (HTTP ${status}): ${safeBody}`);
  }
}

// ------------------------------------------------------------------
// Provider validation. Cheap probe that confirms the key works before
// the user starts a long-running summarize / translate task.
// ------------------------------------------------------------------

export async function validateProvider(resolved: ResolvedProvider): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    const client = createClientFor(resolved);
    await client.chat(
      [
        { role: "system", content: "Reply with the single word: OK" },
        { role: "user", content: "ping" },
      ],
      { temperature: 0, maxTokens: 8 }
    );
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t0, error: (e as Error).message };
  }
}
