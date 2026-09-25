import { ask, ingestArxiv, summarize, getUserConfig } from "../lib/apiClient.js";

const $ = (id) => document.getElementById(id);

let currentPaper = null;
let selectedLanguage = "en";
let revision = 0;
let chatHistory = [];
let chatRevision = 0;
let asking = false;

function clearChat() {
  chatHistory = [];
  chatRevision++;
  asking = false;
  $("askBtn").disabled = false;
  $("qaLog").innerHTML = "";
}

async function renderSummary(paperId, summary) {
  $("summarySection").hidden = false;
  const container = $("summaryContainer");
  container.innerHTML = "";
  if (!summary) {
    container.innerHTML = `<p class="muted">Choose a summary language above. / 请在上方选择总结语言。</p>`;
    return;
  }
  for (const lang of [selectedLanguage]) {
    const s = summary.summaries[lang];
    if (!s) continue;
    const card = document.createElement("div");
    card.className = `card ${lang}`;
    card.innerHTML = `
      <h3>${lang === "zh" ? "中文总结" : "English summary"}</h3>
      <p class="muted">${lang === "zh" ? "基于选取的论文片段，不是全文逐页审查。重要结论请核对原文。" : "Based on selected excerpts, not an exhaustive review. Check important claims against the paper."}</p>
      <p><strong>${lang === "zh" ? "一句话" : "One-line"}:</strong>${escapeHtml(s.oneLine)}</p>
      <p><strong>${lang === "zh" ? "关键点" : "Key points"}:</strong></p>
      <ul>${s.keyPoints.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      <p><strong>${lang === "zh" ? "想解决什么问题？" : "What is the problem?"}</strong> ${escapeHtml(s.background)}</p>
      <p><strong>${lang === "zh" ? "以前怎么做？" : "What did people try before?"}</strong> ${escapeHtml(s.priorWork)}</p>
      <p><strong>${lang === "zh" ? "新办法怎么做？" : "How does the new idea work?"}</strong> ${escapeHtml(s.method)}</p>
      <p><strong>${lang === "zh" ? "发现了什么？" : "What did they find?"}</strong> ${escapeHtml(s.results)}</p>
      ${s.verifyNumbers && s.verifyNumbers.length
        ? `<p class="muted">${lang === "zh" ? "需要复核的数字" : "Numbers to verify"}: ${s.verifyNumbers.map(escapeHtml).join("; ")}</p>`
        : ""}
    `;
    container.appendChild(card);
  }
}

async function generateSummary(target) {
  if (!currentPaper) return;
  selectedLanguage = target;
  const paper = currentPaper;
  const requestRevision = ++revision;
  $("summarySection").hidden = false;
  $("summaryContainer").textContent = target === "zh" ? "正在用简单的话总结…" : "Writing a simple summary…";
  try {
    const summary = await summarize(paper.id, target);
    if (revision !== requestRevision) return;
    renderSummary(paper.id, summary);
    await chrome.runtime.sendMessage({ type: "PK_RESULT", payload: { kind: "summary", paperId: paper.id, paper, summary } });
  } catch (e) {
    if (revision === requestRevision) $("summaryContainer").textContent = `${target === "zh" ? "总结失败" : "Summary failed"}: ${e.message}`;
  }
}

async function renderAsk(paperId, question) {
  if (asking) return;
  asking = true;
  $("askBtn").disabled = true;
  const requestRevision = chatRevision;
  const language = selectedLanguage;
  const log = $("qaLog");
  const item = document.createElement("div");
  item.className = "qa-item";
  item.innerHTML = `<div class="qa-q">Q: ${escapeHtml(question)}</div><div class="qa-a">${language === "zh" ? "思考中…" : "Thinking…"}</div>`;
  log.appendChild(item);
  item.scrollIntoView({ behavior: "smooth" });
  try {
    const r = await ask(paperId, question.slice(0, 4000), language, chatHistory);
    if (requestRevision !== chatRevision) return;
    chatHistory = [...chatHistory, { role: "user", content: question.slice(0, 4000) }, { role: "assistant", content: r.answer.slice(0, 4000) }].slice(-6);
    const modes = language === "zh"
      ? { semantic: "依据：语义检索片段", keyword: "依据：关键词匹配片段（向量检索不可用或未返回结果）", abstract: "注意：未找到相关正文，仅依据摘要" }
      : { semantic: "Based on semantically retrieved excerpts", keyword: "Based on keyword matches (semantic retrieval unavailable or empty)", abstract: "Limited context: no matching body text; abstract only" };
    item.querySelector(".qa-a").innerHTML = `${escapeHtml(r.answer)}
      <div class="muted">${escapeHtml(modes[r.retrievalMode] || "")}</div>
      ${r.citations.map((c) => `<div class="citation"><strong>${escapeHtml(c.sectionTitle)}</strong>: ${escapeHtml(c.snippet)}</div>`).join("")}`;
  } catch (e) {
    if (requestRevision === chatRevision) item.querySelector(".qa-a").textContent = `${language === "zh" ? "失败" : "Failed"}: ${e.message}`;
  } finally {
    if (requestRevision === chatRevision) { asking = false; $("askBtn").disabled = false; }
  }
  item.scrollIntoView({ behavior: "smooth" });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

$("summaryEn").addEventListener("click", () => generateSummary("en"));
$("summaryZh").addEventListener("click", () => generateSummary("zh"));
$("askBtn").addEventListener("click", () => {
  const q = $("question").value.trim();
  if (q && currentPaper) return renderAsk(currentPaper.id, q);
});
$("clearLog").addEventListener("click", clearChat);

function showResult(p) {
  if (currentPaper?.id !== p.paper.id) clearChat();
  revision++;
  currentPaper = p.paper;
  selectedLanguage = p.summary?.language === "zh" ? "zh" : "en";
  $("paperMeta").textContent = `${p.paper.title} · ${p.paper.id}`;
  if (p.kind === "summary") renderSummary(p.paperId, p.summary);
}

let importing = false;
async function importPending() {
  if (importing) return;
  importing = true;
  try {
    const { arxivId } = await chrome.runtime.sendMessage({ type: "PK_TAKE_IMPORT" });
    if (!arxivId) return;
    revision++;
    clearChat();
    currentPaper = null;
    $("summarySection").hidden = true;
    $("paperMeta").textContent = `Importing ${arxivId}…`;
    const cfg = await getUserConfig();
    if (cfg.provider !== "ollama" && !cfg.apiKey) throw new Error("请先在扩展设置中填入 API Key。");
    const { paper } = await ingestArxiv(arxivId);
    const summary = null;
    const payload = { kind: "summary", paperId: paper.id, paper, summary };
    showResult(payload);
    await chrome.runtime.sendMessage({ type: "PK_RESULT", payload });
  } catch (e) {
    $("paperMeta").textContent = `失败：${e.message}`;
  } finally {
    importing = false;
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "PK_RESULT") showResult(msg.payload);
  if (msg?.type === "PK_ARXIV_TO_IMPORT") importPending();
});

(async () => {
  try {
    const state = await chrome.runtime.sendMessage({ type: "PK_GET_STATE" });
    if (state?.paper) showResult({ kind: "summary", paperId: state.paper.id, ...state });
    await importPending();
  } catch (e) {
    $("paperMeta").textContent = `失败：${e.message}`;
  }
})();
