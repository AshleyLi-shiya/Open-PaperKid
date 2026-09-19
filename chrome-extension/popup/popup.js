import {
  arxivIdFromUrl,
  hfPapersIdFromUrl,
  health,
  getUserConfig,
  getApiBase,
} from "../lib/apiClient.js";

const statusEl = document.getElementById("status");
const arxivEl = document.getElementById("arxivId");
const providerEl = document.getElementById("provider");
let activeTab = null;

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = `status ${kind || ""}`;
}

async function refresh() {
  try {
    const h = await health();
    setStatus(`服务正常 · 后端 ${h.version || "?"}`, "ok");
  } catch (e) {
    setStatus(`无法连接：${e.message}`, "err");
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;
  const id = tab?.url ? arxivIdFromUrl(tab.url) || hfPapersIdFromUrl(tab.url) : null;
  arxivEl.textContent = id || "—";
  document.getElementById("summarize").disabled = !id;

  const cfg = await getUserConfig();
  providerEl.textContent = cfg.provider || "openai";
  if (cfg.provider !== "ollama" && !cfg.apiKey) {
    setStatus(`未配置 ${cfg.provider} API Key · 请先到设置页填入 Key`, "err");
    document.getElementById("summarize").disabled = true;
  }
}

document.getElementById("openSettings").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById("sidePanel").addEventListener("click", async () => {
  if (activeTab?.id) await chrome.sidePanel.open({ tabId: activeTab.id });
});

document.getElementById("uploadLocal").addEventListener("click", () => {
  document.getElementById("localFile").click();
});

document.getElementById("localFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setStatus(`上传 ${file.name}…`);
  try {
    if (activeTab?.id) await chrome.sidePanel.open({ tabId: activeTab.id });
    const buf = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    const b64 = btoa(binary);
    const apiBase = await getApiBase();
    const headers = {
      "content-type": "application/json",
    };
    const cfg = await getUserConfig();
    headers["x-paperkid-provider"] = cfg.provider || "openai";
    if (cfg.apiKey) headers["x-paperkid-api-key"] = cfg.apiKey;
    if (cfg.baseUrl) headers["x-paperkid-base-url"] = cfg.baseUrl;
    if (cfg.model) headers["x-paperkid-model"] = cfg.model;
    const r = await fetch(`${apiBase}/api/papers/ingest-local-upload`, {
      method: "POST",
      headers,
      body: JSON.stringify({ filename: file.name, b64 }),
    });
    if (!r.ok) {
      const detail = await r.json().catch(() => ({}));
      throw new Error(detail.error || `HTTP ${r.status}`);
    }
    const json = await r.json();
    setStatus(`已导入：${json.paper.title}`, "ok");
    await chrome.runtime.sendMessage({
      type: "PK_RESULT",
      payload: { kind: "summary", paperId: json.paper.id, paper: json.paper, summary: null },
    });
  } catch (e) {
    setStatus(`失败：${e.message}`, "err");
  }
});

document.getElementById("summarize").addEventListener("click", async () => {
  const tab = activeTab;
  const id = tab?.url ? arxivIdFromUrl(tab.url) || hfPapersIdFromUrl(tab.url) : null;
  if (!id) return;
  setStatus("导入并总结中…");
  try {
    const result = await chrome.runtime.sendMessage({ type: "PK_OPEN_PAPER", arxivId: id, tabId: tab.id });
    if (result?.error) throw new Error(result.error);
    setStatus("已在侧边栏开始处理。", "ok");
  } catch (e) {
    setStatus(`失败：${e.message}`, "err");
  }
});

refresh();
