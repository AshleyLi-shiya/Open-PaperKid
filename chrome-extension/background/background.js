// Background service worker. Holds "current paper" state across popup & sidepanel.

let lastPaper = null;
let lastSummary = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "PK_RESULT") {
    lastPaper = msg.payload.paper;
    lastSummary = msg.payload.summary;
  }
  if (msg?.type === "PK_GET_STATE") {
    sendResponse({ paper: lastPaper, summary: lastSummary });
    return true;
  }
  if (msg?.type === "PK_GET_TAB_ID") {
    // Return sender.tab.id to allow content scripts to ask the sidepanel to open.
    sendResponse({ tabId: sender.tab?.id });
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "pk-arxiv-import",
    title: "用 Open-PaperKid 总结这篇论文",
    contexts: ["link"],
    targetUrlPatterns: ["https://arxiv.org/abs/*"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "pk-arxiv-import") return;
  const m = info.linkUrl?.match(/arxiv\.org\/abs\/([0-9]+\.[0-9]+(?:v[0-9]+)?)/);
  const arxivId = m?.[1];
  if (!arxivId || !tab?.id) return;
  chrome.sidePanel.open({ tabId: tab.id });
  chrome.runtime.sendMessage({ type: "PK_ARXIV_TO_IMPORT", arxivId });
});