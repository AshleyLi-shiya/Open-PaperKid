// Injected into arxiv / OpenReview / HF pages. Adds a "summarize" button so
// users can one-click without using the popup.

function detectPaperId() {
  const url = new URL(location.href);
  return url.pathname.match(/^\/(?:abs|pdf|papers)\/([0-9]+\.[0-9]+(?:v[0-9]+)?)/)?.[1] || null;
}

function makeButton() {
  const btn = document.createElement("button");
  btn.id = "paperkid-btn";
  btn.textContent = "📘 Open-PaperKid 总结";
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
    alert("Open-PaperKid: 当前页面不是 arxiv 论文。");
    return;
  }
  try {
    // Open immediately from the click. Network requests run in the extension,
    // where host permissions apply, rather than in the paper site's origin.
    const result = await chrome.runtime.sendMessage({ type: "PK_OPEN_PAPER", arxivId });
    if (result?.error) throw new Error(result.error);
  } catch (e) {
    alert(`Open-PaperKid: ${e.message}`);
  }
}

function init() {
  if (!detectPaperId()) return;
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
