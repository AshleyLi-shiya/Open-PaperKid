import { ask, translatePaper, ingestArxiv, summarize, getUserConfig } from "../lib/apiClient.js";

const $ = (id) => document.getElementById(id);

let currentPaper = null;

async function renderSummary(paperId, summary) {
  $("summarySection").hidden = false;
  const container = $("summaryContainer");
  container.innerHTML = "";
  if (!summary) {
    container.innerHTML = `<p class="muted">导入完成。点击上方翻译按钮翻译全文,或在下文提问。</p>`;
    return;
  }
  for (const lang of ["zh", "en"]) {
    const s = summary.summaries[lang];
    if (!s) continue;
    const card = document.createElement("div");
    card.className = `card ${lang}`;
    card.innerHTML = `
      <h3>${lang === "zh" ? "中文总结" : "English summary"}</h3>
      <p><strong>${lang === "zh" ? "一句话" : "One-line"}:</strong>${escapeHtml(s.oneLine)}</p>
      <p><strong>${lang === "zh" ? "关键点" : "Key points"}:</strong></p>
      <ul>${s.keyPoints.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      <p><strong>${lang === "zh" ? "研究背景" : "Background"}:</strong>${escapeHtml(s.background)}</p>
      <p><strong>${lang === "zh" ? "过去方案" : "Prior work"}:</strong>${escapeHtml(s.priorWork)}</p>
      <p><strong>${lang === "zh" ? "本文方法" : "Method"}:</strong>${escapeHtml(s.method)}</p>
      <p><strong>${lang === "zh" ? "实验结果" : "Results"}:</strong>${escapeHtml(s.results)}</p>
      ${s.verifyNumbers && s.verifyNumbers.length
        ? `<p class="muted">${lang === "zh" ? "需要复核的数字" : "Numbers to verify"}: ${s.verifyNumbers.map(escapeHtml).join("; ")}</p>`
        : ""}
    `;
    container.appendChild(card);
  }
}

async function renderTranslate(paperId, target) {
  $("translateSection").hidden = false;
  $("translateContainer").innerHTML = `<p class="muted">翻译中…</p>`;
  try {
    const r = await translatePaper(paperId, target);
    $("translateContainer").innerHTML = r.sections
      .map((sec) => `<div class="card ${target}"><h3>${escapeHtml(sec.title)}</h3><pre>${escapeHtml(sec.translated)}</pre></div>`)
      .join("");
  } catch (e) {
    $("translateContainer").innerHTML = `<p class="muted">翻译失败:${escapeHtml(e.message)}</p>`;
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
    const r = await ask(paperId, question, "zh");
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

$("translateZh").addEventListener("click", () => currentPaper && renderTranslate(currentPaper.id, "zh"));
$("translateEn").addEventListener("click", () => currentPaper && renderTranslate(currentPaper.id, "en"));
$("askBtn").addEventListener("click", () => {
  const q = $("question").value.trim();
  if (q && currentPaper) renderAsk(currentPaper.id, q);
});
$("clearLog").addEventListener("click", () => ($("qaLog").innerHTML = ""));

function showResult(p) {
  currentPaper = { id: p.paperId, title: p.paper.title };
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
    $("paperMeta").textContent = `导入并总结 ${arxivId}…`;
    const cfg = await getUserConfig();
    if (cfg.provider !== "ollama" && !cfg.apiKey) throw new Error("请先在扩展设置中填入 API Key。");
    const { paper } = await ingestArxiv(arxivId);
    const summary = await summarize(paper.id, "both");
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
