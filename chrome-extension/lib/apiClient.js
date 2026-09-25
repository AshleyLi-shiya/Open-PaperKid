// Shared client code used by popup, sidepanel, options, and content script.
// Plain ES module — no build step required so the extension loads from disk.

const DEFAULT_API_BASE = "http://localhost:5174";

// In-memory cache of the active user config. Source of truth is chrome.storage.
let _configCache = null;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.paperkidConfig) _configCache = null;
});

export async function getApiBase() {
  const c = await getUserConfig();
  return c.apiBase || DEFAULT_API_BASE;
}

export async function setApiBase(url) {
  const c = await getUserConfig();
  c.apiBase = url;
  await chrome.storage.local.set({ paperkidConfig: c });
  _configCache = c;
}

const DEFAULT_USER_CONFIG = {
  apiBase: DEFAULT_API_BASE,
  provider: "openai",          // openai | anthropic | deepseek | ollama
  apiKey: "",
  baseUrl: "",
  model: "",
  // Read-only flags from server (cached for 5 min)
  providers: null,
  lastValidated: 0,
};

export async function getUserConfig() {
  if (_configCache) return _configCache;
  const { paperkidConfig } = await chrome.storage.local.get("paperkidConfig");
  _configCache = { ...DEFAULT_USER_CONFIG, ...(paperkidConfig || {}) };
  return _configCache;
}

export async function setUserConfig(patch) {
  const c = await getUserConfig();
  const next = { ...c, ...patch };
  await chrome.storage.local.set({ paperkidConfig: next });
  _configCache = next;
  return next;
}

export async function clearApiKey() {
  const c = await getUserConfig();
  c.apiKey = "";
  await chrome.storage.local.set({ paperkidConfig: c });
  _configCache = c;
  return c;
}

/**
 * Build the headers we send to the backend. Backend reads them per request.
 * - x-paperkid-provider: openai | anthropic | deepseek | ollama
 * - x-paperkid-api-key: the user's key (sk-xxx). Backend NEVER logs this.
 * - x-paperkid-base-url: optional override (Ollama, self-hosted proxies)
 * - x-paperkid-model: optional override
 */
async function providerHeaders() {
  const c = await getUserConfig();
  const h = {
    "x-paperkid-provider": c.provider || "openai",
  };
  if (c.apiKey) h["x-paperkid-api-key"] = c.apiKey;
  if (c.baseUrl) h["x-paperkid-base-url"] = c.baseUrl;
  if (c.model) h["x-paperkid-model"] = c.model;
  return h;
}

async function request(path, options = {}) {
  const apiBase = await getApiBase();
  const headers = {
    "content-type": "application/json",
    ...(await providerHeaders()),
    ...(options.headers || {}),
  };
  let res;
  try {
    res = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
    });
  } catch (e) {
    throw new Error(`无法连接 ${apiBase} — 请检查后端是否运行、API 地址是否正确。错误:${e.message}`);
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).error || "";
    } catch (_) {}
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function health() {
  return request("/api/health");
}

export async function listProviders() {
  // Try cache first
  const c = await getUserConfig();
  if (c.providers && Date.now() - (c.lastValidated || 0) < 5 * 60 * 1000) {
    return c.providers;
  }
  try {
    const r = await request("/api/providers");
    await setUserConfig({ providers: r.providers, lastValidated: Date.now() });
    return r.providers;
  } catch (e) {
    // Fallback: ship a hardcoded list so UI still works when offline.
    return [
      { id: "openai", label: "OpenAI (ChatGPT)", needsApiKey: true, recommendedModel: "gpt-4o-mini" },
      { id: "anthropic", label: "Anthropic (Claude)", needsApiKey: true, recommendedModel: "claude-3-5-sonnet-latest" },
      { id: "deepseek", label: "DeepSeek", needsApiKey: true, recommendedModel: "deepseek-chat" },
      { id: "ollama", label: "Ollama (本地模型)", needsApiKey: false, recommendedModel: "qwen2.5:7b" },
    ];
  }
}

export async function validateProvider() {
  return request("/api/providers/validate", { method: "POST" });
}

export async function ingestArxiv(arxivId) {
  return request("/api/papers/ingest", {
    method: "POST",
    body: JSON.stringify({ arxivId }),
  });
}

export async function listPapers() {
  return request("/api/papers");
}

export async function getPaper(id) {
  return request(`/api/papers/${encodeURIComponent(id)}`);
}

export async function deletePaper(id) {
  return request(`/api/papers/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function summarize(id, language = "en") {
  return request(`/api/papers/${encodeURIComponent(id)}/summarize`, {
    method: "POST",
    body: JSON.stringify({ language }),
  });
}

export async function translatePaper(id, targetLanguage) {
  return request(`/api/papers/${encodeURIComponent(id)}/translate`, {
    method: "POST",
    body: JSON.stringify({ targetLanguage }),
  });
}

export async function ask(id, question, language = "en", history = []) {
  return request(`/api/papers/${encodeURIComponent(id)}/ask`, {
    method: "POST",
    body: JSON.stringify({ question, language, history }),
  });
}

export function arxivIdFromUrl(url) {
  const m = url.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]+\.[0-9]+(?:v[0-9]+)?)/);
  return m ? m[1] : null;
}

export function hfPapersIdFromUrl(url) {
  const m = url.match(/huggingface\.co\/papers\/([0-9]+\.[0-9]+(?:v[0-9]+)?)/);
  return m ? m[1] : null;
}

/**
 * Tiny self-test used by the options page.
 */
export async function selftest() {
  const c = await getUserConfig();
  const issues = [];
  if (!c.apiBase) issues.push("未设置服务器地址");
  if (!c.provider) issues.push("未选择 Provider");
  if (c.provider !== "ollama" && !c.apiKey) issues.push(`${c.provider} 需要 API Key`);
  return { ok: issues.length === 0, issues, config: c };
}
