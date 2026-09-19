// Background service worker. Holds "current paper" state across popup & sidepanel.

let pendingImport = null;
let stateWrite = Promise.resolve();

function openPaper(arxivId, tabId) {
  if (!arxivId || !Number.isInteger(tabId)) return Promise.reject(new Error("无法确定论文或标签页"));
  pendingImport = arxivId;
  // Open before awaiting anything to retain Chrome's user gesture.
  return chrome.sidePanel.open({ tabId }).then(() => {
    chrome.runtime.sendMessage({ type: "PK_ARXIV_TO_IMPORT" }).catch(() => {});
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "PK_OPEN_PAPER") {
    openPaper(msg.arxivId, sender.tab?.id ?? msg.tabId)
      .then(() => sendResponse({ ok: true }), (e) => sendResponse({ error: e.message }));
    return true;
  }
  if (msg?.type === "PK_TAKE_IMPORT") {
    sendResponse({ arxivId: pendingImport });
    pendingImport = null;
  }
  if (msg?.type === "PK_RESULT") {
    stateWrite = chrome.storage.session.set({ paperkidResult: {
      paper: msg.payload.paper, summary: msg.payload.summary,
    } });
    stateWrite.then(() => sendResponse({ ok: true }), (e) => sendResponse({ error: e.message }));
    return true;
  }
  if (msg?.type === "PK_GET_STATE") {
    stateWrite.then(() => chrome.storage.session.get("paperkidResult"))
      .then(({ paperkidResult }) => sendResponse(paperkidResult || {}), () => sendResponse({}));
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
  openPaper(arxivId, tab.id).catch(console.error);
});
