const ACTIVE_BADGE = "ON";
const INACTIVE_BADGE = "";

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: "#3fb950" });
});

function dataUrlForText(text, mimeType = "text/plain;charset=utf-8") {
  return `data:${mimeType},${encodeURIComponent(String(text ?? ""))}`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "M365CE_EXTENSION_ACTIVE_STATE") {
    const tabId = sender?.tab?.id;
    if (tabId != null) {
      chrome.action.setBadgeText({ tabId, text: message.active ? ACTIVE_BADGE : INACTIVE_BADGE });
      chrome.action.setTitle({ tabId, title: message.active ? "M365 Copilot Chat Conversation Exporter — active" : "M365 Copilot Chat Conversation Exporter" });
    }
    sendResponse({ ok: true });
    return false;
  }
  if (message?.type === "M365CE_DOWNLOAD_TEXT") {
    const url = dataUrlForText(message.text, message.mimeType || "text/plain;charset=utf-8");
    const filename = message.filename || "m365-copilot-extension-output.txt";
    chrome.downloads.download({ url, filename, saveAs: false, conflictAction: "uniquify" }, (downloadId) => {
      const error = chrome.runtime.lastError?.message;
      sendResponse(error ? { ok: false, error, filename } : { ok: true, downloadId, filename, method: "background-downloads-api" });
    });
    return true;
  }
  return false;
});
