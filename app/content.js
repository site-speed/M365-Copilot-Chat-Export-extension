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

// Microsoft 365 Copilot Chat is served from the legacy hosts and from the
// redirected copilot.cloud.microsoft host (Microsoft's 2026 web URL move).
// Legacy hosts keep their /chat path requirement because the manifest only
// injects this content script on legacy chat paths; the redirected app can open
// a chat from any path, including the root URL.
const COPILOT_REDIRECTED_HOST = "copilot.cloud.microsoft";
const COPILOT_LEGACY_HOSTS = ["m365.cloud.microsoft", "microsoft365.com", "www.microsoft365.com"];
const CONVERSATION_ID_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONVERSATION_ID_COMPACT_PATTERN = /^[0-9a-f]{32}$/i;
const CONVERSATION_PATH_ID_PATTERN = /(?:^|\/)(?:conversation|chats?)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})(?=$|[\/?#])/i;
const CONVERSATION_ID_QUERY_KEYS = ["conversationid", "chatid", "cid", "id"];

function isSupportedCopilotHost(href = location.href) {
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return host === COPILOT_REDIRECTED_HOST || COPILOT_LEGACY_HOSTS.includes(host);
  } catch {
    return false;
  }
}

function isRelevantChatPage(href = location.href) {
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (host === COPILOT_REDIRECTED_HOST) {
      return true;
    }
    return COPILOT_LEGACY_HOSTS.includes(host) && parsed.pathname.toLowerCase().includes("/chat");
  } catch {
    return false;
  }
}

function isConversationIdValue(value) {
  const text = String(value ?? "").trim();
  return CONVERSATION_ID_UUID_PATTERN.test(text) || CONVERSATION_ID_COMPACT_PATTERN.test(text);
}

// Only recognised conversation routes and conversation-specific query
// parameters may supply a conversation ID. Scanning the whole URL (or accepting
// arbitrary query values such as ?tenantId=) would classify non-chat pages as
// exportable and send a wrong ID to Substrate.
function inferConversationIdFromUrl(href = location.href) {
  let url;
  try {
    url = new URL(String(href || ""));
  } catch {
    return null;
  }
  const routePaths = [url.pathname];
  const hashRoute = String(url.hash || "").replace(/^#/, "").split("?")[0];
  if (hashRoute.startsWith("/")) {
    routePaths.push(hashRoute);
  }
  for (const routePath of routePaths) {
    const pathMatch = routePath.match(CONVERSATION_PATH_ID_PATTERN);
    if (pathMatch) {
      return pathMatch[1];
    }
  }
  for (const [key, value] of url.searchParams) {
    if (CONVERSATION_ID_QUERY_KEYS.includes(key.toLowerCase()) && isConversationIdValue(value)) {
      return value.trim();
    }
  }
  return null;
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
