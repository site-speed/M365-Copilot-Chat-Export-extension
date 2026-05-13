const BRIDGE_SOURCE = "m365ce-extension-bridge";
const CONTENT_SOURCE = "m365ce-extension-content";
const pendingBridgeRequests = new Map();
let rendererInjected = false;
let bridgeInjected = false;

function inferConversationIdFromUrl(href = location.href) {
  try {
    const url = new URL(href);
    const pathConversationMatch = url.pathname.match(/(?:^|\/)conversation\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:$|\/)/);
    if (pathConversationMatch) {
      return pathConversationMatch[1];
    }
    for (const key of ["conversationId", "chatId", "cid", "id"]) {
      const value = url.searchParams.get(key);
      if (value) {
        return value;
      }
    }
  } catch {
    // Fall through to generic matching below.
  }
  const uuidMatch = String(href).match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (uuidMatch) {
    return uuidMatch[0];
  }
  const compactMatch = String(href).match(/[0-9a-fA-F]{32}/);
  return compactMatch ? compactMatch[0] : null;
}

function isRelevantChatPage() {
  return /^https:\/\/(m365\.cloud\.microsoft|(?:www\.)?microsoft365\.com)\//i.test(location.href) && location.href.includes("/chat");
}

function injectScriptFile(filename, datasetKey, onload) {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL(filename);
  script.dataset[datasetKey] = "true";
  script.onload = () => { script.remove(); if (onload) { onload(); } };
  (document.documentElement || document.head || document.body).appendChild(script);
}

function injectPageBridge() {
  if (bridgeInjected) {
    return;
  }
  bridgeInjected = true;
  injectScriptFile("page-bridge.js", "m365ceBridge");
}

function injectBridge() {
  if (!rendererInjected) {
    rendererInjected = true;
    injectScriptFile("renderer-bridge.js", "m365ceRendererBridge", injectPageBridge);
    return;
  }
  injectPageBridge();
}

function sendActiveState() {
  chrome.runtime.sendMessage({ type: "M365CE_EXTENSION_ACTIVE_STATE", active: isRelevantChatPage() }).catch(() => {});
}

function bridgeRequest(type, payload = {}, timeoutMs = 45000) {
  injectBridge();
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingBridgeRequests.delete(requestId);
      resolve({ ok: false, error: `Bridge request timed out after ${timeoutMs}ms` });
    }, timeoutMs);
    pendingBridgeRequests.set(requestId, { resolve, timer });
    window.postMessage({ source: CONTENT_SOURCE, type, requestId, payload }, window.location.origin);
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin) {
    return;
  }
  const data = event.data;
  if (!data || data.source !== BRIDGE_SOURCE || !data.requestId) {
    return;
  }
  const pending = pendingBridgeRequests.get(data.requestId);
  if (!pending) {
    return;
  }
  clearTimeout(pending.timer);
  pendingBridgeRequests.delete(data.requestId);
  pending.resolve(data.payload ?? { ok: false, error: "Missing bridge payload" });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "M365CE_GET_PAGE_INFO") {
    sendResponse({ ok: true, active: isRelevantChatPage(), href: location.href, conversationId: inferConversationIdFromUrl(), refreshedAt: new Date().toISOString() });
    return false;
  }
  if (message?.type === "M365CE_TEST_SUBSTRATE") {
    bridgeRequest("M365CE_BRIDGE_TEST_SUBSTRATE", { conversationId: inferConversationIdFromUrl(), href: location.href }).then(sendResponse);
    return true;
  }
  if (message?.type === "M365CE_GET_LAST_CAPTURED") {
    bridgeRequest("M365CE_BRIDGE_GET_LAST_CAPTURED", {}).then(sendResponse);
    return true;
  }
  if (message?.type === "M365CE_GET_RAW_JSON_MARKDOWN") {
    bridgeRequest("M365CE_BRIDGE_GET_RAW_JSON_MARKDOWN", { conversationId: inferConversationIdFromUrl(), href: location.href }).then(sendResponse);
    return true;
  }
  if (message?.type === "M365CE_GET_EXPORT_FILES") {
    bridgeRequest("M365CE_BRIDGE_GET_EXPORT_FILES", { conversationId: inferConversationIdFromUrl(), href: location.href, options: message?.options || {} }).then(sendResponse);
    return true;
  }
  return false;
});

injectBridge();
sendActiveState();
setInterval(sendActiveState, 2000);
