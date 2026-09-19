// Injected into arxiv / OpenReview / HF pages. Adds a "summarize" button so
// users can one-click without using the popup.

import { arxivIdFromUrl, hfPapersIdFromUrl, getUserConfig, getApiBase } from "../lib/apiClient.js";

function detectPaperId() {
  const url = location.href;
  return arxivIdFromUrl(url) || hfPapersIdFromUrl(url);
}

function makeButton() {
  const btn = document.createElement("button");
  btn.id = "paperkid-btn";
  btn.textContent = "📘 PaperKid 总结";
  btn.style.cssText = `
    position: fixed; right: 20px; bottom: 20px; z-index: 99999;
    padding: 10px 14px; border: 0; border-radius: 8px;
    background: #2563eb; color: white; font-size: 14px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2); cursor: pointer;
  `;
  return btn;
}

async function handleClick() {
  const arxivId = detectPaperId();
  if (!arxivId) {
    alert("PaperKid: 当前页面不是 arxiv 论文。");
    return;
  }
  const cfg = await getUserConfig();
  if (cfg.provider !== "ollama" && !cfg.apiKey) {
    alert("PaperKid: 请先在扩展设置中填入 API Key。");
    return;
  }
  try {
    const apiBase = await getApiBase();
    const headers = { "content-type": "application/json" };
    headers["x-paperkid-provider"] = cfg.provider || "openai";
    if (cfg.apiKey) headers["x-paperkid-api-key"] = cfg.apiKey;
    if (cfg.baseUrl) headers["x-paperkid-base-url"] = cfg.baseUrl;
    if (cfg.model) headers["x-paperkid-model"] = cfg.model;

    const ingest = await fetch(`${apiBase}/api/papers/ingest`, {
      method: "POST",
      headers,
      body: JSON.stringify({ arxivId }),
    }).then((r) => {
      if (!r.ok) throw new Error(`ingest ${r.status}`);
      return r.json();
    });
    const summary = await fetch(`${apiBase}/api/papers/${ingest.paper.id}/summarize`, {
      method: "POST",
      headers,
      body: JSON.stringify({ language: "both" }),
    }).then((r) => {
      if (!r.ok) throw new Error(`summarize ${r.status}`);
      return r.json();
    });
    await chrome.runtime.sendMessage({
      type: "PK_RESULT",
      payload: { kind: "summary", paperId: ingest.paper.id, paper: ingest.paper, summary },
    });
    const tabId = (await chrome.runtime.sendMessage({ type: "PK_GET_TAB_ID" }).catch(() => null))?.tabId;
    if (tabId) await chrome.sidePanel.open({ tabId });
  } catch (e) {
    alert(`PaperKid: ${e.message}`);
  }
}

function init() {
  if (document.getElementById("paperkid-btn")) return;
  const btn = makeButton();
  btn.addEventListener("click", handleClick);
  document.body.appendChild(btn);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}