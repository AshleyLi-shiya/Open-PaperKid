import { ask, ingestArxiv, summarize, getUserConfig } from "../lib/apiClient.js";

const $ = (id) => document.getElementById(id);

let currentPaper = null;
let selectedLanguage = "en";
let revision = 0;

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
  const log = $("qaLog");
  const item = document.createElement("div");
  item.className = "qa-item";
  item.innerHTML = `<div class="qa-q">Q: ${escapeHtml(question)}</div><div class="qa-a">思考中…</div>`;
  log.appendChild(item);
  item.scrollIntoView({ behavior: "smooth" });
  try {
    const r = await ask(paperId, question, selectedLanguage);
    item.querySelector(".qa-a").innerHTML = `${escapeHtml(r.answer)}
      ${r.citations.length ? `<div class="muted">${r.citations.length} 个引用片段:</div>` : ""}
      ${r.citations.map((c) => `<div class="citation"><strong>${escapeHtml(c.sectionTitle)}</strong>: ${escapeHtml(c.snippet)}</div>`).join("")}`;
  } catch (e) {
    item.querySelector(".qa-a").textContent = `失败:${e.message}`;
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
  if (q && currentPaper) renderAsk(currentPaper.id, q);
});
$("clearLog").addEventListener("click", () => ($("qaLog").innerHTML = ""));

function showResult(p) {
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
