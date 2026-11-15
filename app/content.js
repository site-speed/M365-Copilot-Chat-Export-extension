const BRIDGE_SOURCE = "m365ce-extension-bridge";
const CONTENT_SOURCE = "m365ce-extension-content";
const pendingBridgeRequests = new Map();
let rendererInjected = false;
let bridgeInjected = false;
let pageBridgeReady = false;
const bridgeReadyWaiters = new Set();
const BRIDGE_READY_TIMEOUT_MS = 10000;
const BRIDGE_FETCH_TIMEOUT_MS = 90000;
const BRIDGE_CACHED_TIMEOUT_MS = 10000;

// Microsoft 365 Copilot Chat is served from both the legacy host and the new
// copilot.cloud.microsoft host (Microsoft's 2026 web URL redirect). Support
// both so the exporter keeps working before and after tenant migration.
const SUPPORTED_COPILOT_HOSTS = new Set([
  "m365.cloud.microsoft",
  "copilot.cloud.microsoft",
  "microsoft365.com",
  "www.microsoft365.com"
]);

function isSupportedCopilotHost(href = location.href) {
  try {
    const parsed = new URL(href);
    return parsed.protocol === "https:" && SUPPORTED_COPILOT_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

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
  // The new Copilot app can open a chat from the root URL, so "/chat" is no
  // longer a reliable marker. isSpecificChatPage() still requires a
  // conversation ID before the exporter becomes active.
  return isSupportedCopilotHost();
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

function isSpecificChatPage() {
  return isRelevantChatPage() && Boolean(inferConversationIdFromUrl());
}

function sendActiveState() {
  chrome.runtime.sendMessage({ type: "M365CE_EXTENSION_ACTIVE_STATE", active: isSpecificChatPage() && pageBridgeReady }).catch(() => {});
}

function waitForPageBridge(timeoutMs = BRIDGE_READY_TIMEOUT_MS) {
  injectBridge();
  if (pageBridgeReady) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const waiter = () => {
      clearTimeout(timer);
      bridgeReadyWaiters.delete(waiter);
      resolve(true);
    };
    const timer = setTimeout(() => {
      bridgeReadyWaiters.delete(waiter);
      resolve(false);
    }, timeoutMs);
    bridgeReadyWaiters.add(waiter);
  });
}

async function bridgeRequest(type, payload = {}, timeoutMs = BRIDGE_FETCH_TIMEOUT_MS) {
  if (!(await waitForPageBridge())) {
    return { ok: false, errorCode: "bridge-not-ready", requestType: type, error: `Page bridge was not ready after ${BRIDGE_READY_TIMEOUT_MS}ms` };
  }
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingBridgeRequests.delete(requestId);
      resolve({ ok: false, errorCode: "bridge-timeout", requestType: type, error: `Bridge request timed out after ${timeoutMs}ms` });
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
  if (!data || data.source !== BRIDGE_SOURCE) {
    return;
  }
  if (data.type === "M365CE_BRIDGE_READY") {
    pageBridgeReady = true;
    for (const waiter of [...bridgeReadyWaiters]) {
      waiter();
    }
    sendActiveState();
    return;
  }
  if (!data.requestId) {
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
    sendResponse({ ok: true, active: isRelevantChatPage() && pageBridgeReady, bridgeReady: pageBridgeReady, href: location.href, conversationId: inferConversationIdFromUrl(), refreshedAt: new Date().toISOString() });
    return false;
  }
  if (message?.type === "M365CE_TEST_SUBSTRATE") {
    bridgeRequest("M365CE_BRIDGE_TEST_SUBSTRATE", { conversationId: inferConversationIdFromUrl(), href: location.href }, BRIDGE_FETCH_TIMEOUT_MS).then(sendResponse);
    return true;
  }
  if (message?.type === "M365CE_GET_LAST_CAPTURED") {
    bridgeRequest("M365CE_BRIDGE_GET_LAST_CAPTURED", {}, BRIDGE_CACHED_TIMEOUT_MS).then(sendResponse);
    return true;
  }
  if (message?.type === "M365CE_GET_RAW_JSON_MARKDOWN") {
    bridgeRequest("M365CE_BRIDGE_GET_RAW_JSON_MARKDOWN", { conversationId: inferConversationIdFromUrl(), href: location.href }, BRIDGE_FETCH_TIMEOUT_MS).then(sendResponse);
    return true;
  }
  if (message?.type === "M365CE_GET_EXPORT_FILES") {
    bridgeRequest("M365CE_BRIDGE_GET_EXPORT_FILES", { conversationId: inferConversationIdFromUrl(), href: location.href, options: message?.options || {} }, BRIDGE_FETCH_TIMEOUT_MS).then(sendResponse);
    return true;
  }
  return false;
});

injectBridge();
sendActiveState();
setInterval(sendActiveState, 2000);
