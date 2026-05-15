(() => {
  "use strict";

  const BRIDGE_SOURCE = "m365ce-extension-bridge";
  const CONTENT_SOURCE = "m365ce-extension-content";
  const SUBSTRATE_BASE = "https://substrate.office.com/m365Copilot";
  const EXTENSION_VERSION = "1.0.37";
  let lastCapturedConversation = null;
  let lastCapturedRawConversation = null;
  let fetchHookInstalled = false;
  let xhrHookInstalled = false;

  function summarizeConversation(json, source = "unknown") {
    if (!json || typeof json !== "object") {
      return { ok: false, source, error: "No conversation JSON object returned" };
    }
    return { ok: true, source, conversationId: json.conversationId || null, chatName: json.chatName || null, messageCount: Array.isArray(json.messages) ? json.messages.length : null, topLevelKeys: Object.keys(json).sort(), capturedAt: new Date().toISOString() };
  }

  function sanitizeFilename(name) {
    const safe = String(name || "m365-copilot-chat").replace(/[\x00-\x1F\x7F]/g, "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
    return (safe || "m365-copilot-chat").slice(0, 120);
  }

  function isoTimestampForFilename(date = new Date()) {
    return date.toISOString().replace(/:/g, "-");
  }

  function longestFenceRun(text, marker) {
    const escaped = marker === "`" ? "`" : "~";
    const matches = String(text || "").match(new RegExp(`${escaped}+`, "g")) || [];
    return matches.reduce((max, item) => Math.max(max, item.length), 0);
  }

  function renderFencedBlock(text, lang = "text") {
    const body = String(text || "").replace(/\r\n/g, "\n").trimEnd();
    const backtickLen = Math.max(3, longestFenceRun(body, "`") + 1);
    const tildeLen = Math.max(3, longestFenceRun(body, "~") + 1);
    const marker = backtickLen <= tildeLen ? "`" : "~";
    const fence = marker.repeat(marker === "`" ? backtickLen : tildeLen);
    return [`${fence}${lang || ""}`, body, fence].join("\n");
  }

  function rawJsonMarkdown(conversationJson, exportedAt = new Date().toISOString()) {
    const title = conversationJson?.chatName || "M365 Copilot Chat";
    const lines = [];
    lines.push(`# ${title}`);
    lines.push("");
    lines.push(`- Exported: ${exportedAt}`);
    lines.push(`- Source: ${location.href}`);
    if (conversationJson?.conversationId) {
      lines.push(`- ConversationId: ${conversationJson.conversationId}`);
    }
    lines.push(`- ExporterVersion: ${EXTENSION_VERSION}`);
    lines.push("- ExporterRuntime: browser-extension");
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(renderFencedBlock(JSON.stringify(conversationJson, null, 2), "json"));
    return lines.join("\n") + "\n";
  }

  function getCookie(key) {
    return document.cookie.match(`(^|;)\\s*${key}\\s*=\\s*([^;]+)`)?.pop() || "";
  }

  function base64DecToArr(base64String) {
    let s = String(base64String || "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) { s += "="; }
    const bin = atob(s);
    return Uint8Array.from(bin, (c) => c.codePointAt(0) || 0);
  }

  function toArrayBuffer(bufferLike) {
    return Uint8Array.from(bufferLike).buffer;
  }

  async function deriveKey(baseKey, nonce, context) {
    return crypto.subtle.deriveKey({ name: "HKDF", salt: toArrayBuffer(nonce), hash: "SHA-256", info: new TextEncoder().encode(context) }, baseKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  async function decryptPayload(baseKey, nonce, context, encryptedData) {
    const derived = await deriveKey(baseKey, base64DecToArr(nonce), context);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(12) }, derived, toArrayBuffer(base64DecToArr(encryptedData)));
    return new TextDecoder().decode(decrypted);
  }

  async function getEncryptionCookie() {
    const raw = decodeURIComponent(getCookie("msal.cache.encryption"));
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw new Error("Failed to parse msal.cache.encryption cookie"); }
    if (!parsed?.key || !parsed?.id) { throw new Error("No encryption cookie found"); }
    return { id: parsed.id, key: await crypto.subtle.importKey("raw", toArrayBuffer(base64DecToArr(parsed.key)), "HKDF", false, ["deriveKey"]) };
  }

  function walkForMsalIds(node, seen = new WeakSet(), depth = 0) {
    if (!node || typeof node !== "object" || depth > 12 || seen.has(node)) { return null; }
    seen.add(node);
    const objectId = node.objectId || node.oid;
    const tenantId = node.tenantId || node.tid || node.realm;
    const userPrincipalName = node.userPrincipalName || node.upn || node.preferred_username || node.username || node.email;
    if (objectId && tenantId) {
      return { localAccountId: objectId, tenantId, homeAccountId: `${objectId}.${tenantId}`, userPrincipalName: userPrincipalName || null, clientId: "c0ab8ce9-e9a0-42e7-b064-33d422df41f1" };
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walkForMsalIds(item, seen, depth + 1);
        if (found) { return found; }
      }
      return null;
    }
    for (const key of Object.keys(node)) {
      try {
        const found = walkForMsalIds(node[key], seen, depth + 1);
        if (found) { return found; }
      } catch {}
    }
    return null;
  }

  function getMsalIds() {
    try {
      const found = walkForMsalIds(window.__staticRouterHydrationData);
      if (found) { return found; }
    } catch {}
    return { clientId: "c0ab8ce9-e9a0-42e7-b064-33d422df41f1" };
  }

  function decodeJwtPayload(token) {
    try {
      const parts = String(token || "").split(".");
      if (parts.length < 2) { return null; }
      let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      while (payload.length % 4) { payload += "="; }
      return JSON.parse(atob(payload));
    } catch { return null; }
  }

  async function getAccessToken(msalIds) {
    const cookie = await getEncryptionCookie();
    const clientId = msalIds?.clientId || "c0ab8ce9-e9a0-42e7-b064-33d422df41f1";
    const targetAud = "https://substrate.office.com/sydney";
    const candidates = [];
    function collectCandidates(storage, label) {
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        const raw = key ? storage.getItem(key) : "";
        if (raw && raw.length >= 20) { candidates.push({ key, raw, storage: label }); }
      }
    }
    collectCandidates(localStorage, "localStorage");
    collectCandidates(sessionStorage, "sessionStorage");
    const audiences = [];
    for (const entry of candidates) {
      let payload;
      try { payload = JSON.parse(entry.raw); } catch { continue; }
      if (!payload?.nonce || !payload?.data) { continue; }
      let decrypted;
      try { decrypted = await decryptPayload(cookie.key, payload.nonce, clientId, payload.data); } catch { continue; }
      let parsed;
      try { parsed = JSON.parse(decrypted); } catch { continue; }
      if (!parsed?.secret) { continue; }
      const jwt = decodeJwtPayload(parsed.secret);
      if (!jwt?.aud) { continue; }
      audiences.push({ storage: entry.storage, aud: jwt.aud });
      if (jwt.aud === targetAud) { return { token: parsed.secret, tokenPayload: jwt, cacheItem: parsed, candidateAudiences: audiences }; }
    }
    const audSummary = audiences.map((x) => x.aud).filter(Boolean).join(", ");
    throw new Error(audSummary ? `No Substrate token found. Candidate audiences: ${audSummary}` : "No decryptable MSAL access token found in browser storage");
  }

  async function getTokenAndIds() {
    const hintedIds = getMsalIds();
    const tokenInfo = await getAccessToken(hintedIds);
    const jwt = tokenInfo?.tokenPayload || {};
    const cacheItem = tokenInfo?.cacheItem || {};
    const localAccountId = hintedIds.localAccountId || jwt.oid || cacheItem.localAccountId || cacheItem.local_account_id;
    const tenantId = hintedIds.tenantId || jwt.tid || cacheItem.realm || cacheItem.tenantId;
    const userPrincipalName = hintedIds.userPrincipalName || jwt.preferred_username || jwt.upn || cacheItem.username || null;
    if (!localAccountId || !tenantId) { throw new Error("Failed to resolve identity from hydration state / token payload"); }
    return { token: tokenInfo.token, localAccountId, tenantId, userPrincipalName, clientId: hintedIds.clientId, tokenDebug: tokenInfo.candidateAudiences || [] };
  }

  async function substrateGetConversation(auth, conversationId) {
    const request = { conversationId, source: "officeweb", traceId: crypto.randomUUID().replace(/-/g, "") };
    const url = `${SUBSTRATE_BASE}/GetConversation?request=${encodeURIComponent(JSON.stringify(request))}`;
    const headers = { authorization: `Bearer ${auth.token}`, "content-type": "application/json", "x-anchormailbox": auth.userPrincipalName || `Oid:${auth.localAccountId}@${auth.tenantId}`, "x-tenant-id": auth.tenantId, "x-client-application": "M365CopilotChat", "x-clientrequestid": crypto.randomUUID().replace(/-/g, ""), "x-routingparameter-sessionkey": auth.localAccountId, "x-scenario": "OfficeWeb" };
    const resp = await fetch(url, { method: "GET", headers });
    if (!resp.ok) { throw new Error(`GetConversation returned ${resp.status}`); }
    return resp.json();
  }

  async function fetchCurrentConversation(conversationId) {
    if (!conversationId) { throw new Error("No conversation ID detected in the current tab URL"); }
    const auth = await getTokenAndIds();
    const json = await substrateGetConversation(auth, conversationId);
    lastCapturedRawConversation = json;
    lastCapturedConversation = summarizeConversation(json, "direct-substrate-fetch");
    return { json, auth, summary: lastCapturedConversation };
  }


  function isSubstrateGetConversationUrl(rawUrl) {
    try {
      const parsedUrl = new URL(String(rawUrl || ""), location.href);
      return parsedUrl.hostname === "substrate.office.com" && parsedUrl.pathname.includes("GetConversation");
    } catch {
      return false;
    }
  }

  function installFetchHook() {
    if (fetchHookInstalled) { return; }
    fetchHookInstalled = true;
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      const response = await originalFetch.apply(this, args);
      if (isSubstrateGetConversationUrl(url)) {
        response.clone().json().then((json) => { lastCapturedRawConversation = json; lastCapturedConversation = summarizeConversation(json, "observed-fetch"); }).catch(() => {});
      }
      return response;
    };
  }

  function installXhrHook() {
    if (xhrHookInstalled) { return; }
    xhrHookInstalled = true;
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) { this.__m365ceUrl = url; return originalOpen.call(this, method, url, ...rest); };
    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener("load", function () {
        try {
          const url = this.__m365ceUrl || "";
          if (isSubstrateGetConversationUrl(url)) {
            const json = JSON.parse(this.responseText);
            lastCapturedRawConversation = json;
            lastCapturedConversation = summarizeConversation(json, "observed-xhr");
          }
        } catch {}
      });
      return originalSend.apply(this, args);
    };
  }

  async function handleTestSubstrate(payload) {
    const fetched = await fetchCurrentConversation(payload?.conversationId);
    return { ...fetched.summary, tokenAudiences: fetched.auth.tokenDebug || [], userPrincipalNamePresent: Boolean(fetched.auth.userPrincipalName), tenantIdPresent: Boolean(fetched.auth.tenantId), localAccountIdPresent: Boolean(fetched.auth.localAccountId) };
  }

  async function handleRawJsonMarkdown(payload) {
    const fetched = await fetchCurrentConversation(payload?.conversationId);
    const exportedAt = new Date().toISOString();
    const filenameTimestamp = isoTimestampForFilename(new Date(exportedAt));
    const markdown = rawJsonMarkdown(fetched.json, exportedAt);
    const baseName = sanitizeFilename(fetched.json?.chatName || fetched.json?.conversationId || "m365-copilot-chat");
    return { ok: true, summary: fetched.summary, filename: `${baseName}_${filenameTimestamp}.json.md`, markdown };
  }


  async function handleExportFiles(payload) {
    const fetched = await fetchCurrentConversation(payload?.conversationId);
    const exportedAt = new Date().toISOString();
    const timestamp = isoTimestampForFilename(new Date(exportedAt));
    const baseName = `${sanitizeFilename(fetched.json?.chatName || fetched.json?.conversationId || "m365-copilot-chat")}_${timestamp}`;
    const renderer = window.M365CopilotExporterRenderer;
    if (!renderer?.toMarkdownCardFirst || !renderer?.toRawJsonMarkdown) {
      throw new Error("Readable Markdown renderer is not available in the page bridge");
    }
    if (renderer?.setExportOptions) {
      renderer.setExportOptions(payload?.options || {});
    }
    const readableMarkdown = renderer.toMarkdownCardFirst(fetched.json, exportedAt);
    const rawMarkdown = rawJsonMarkdown(fetched.json, exportedAt);
    const files = [{ filename: `${baseName}.md`, text: readableMarkdown, mimeType: "text/markdown;charset=utf-8" }, { filename: `${baseName}.json.md`, text: rawMarkdown, mimeType: "text/markdown;charset=utf-8" }];
    return { ok: true, exportedAt, files, summary: fetched.summary, rendererVersion: renderer.version || EXTENSION_VERSION };
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) { return; }
    const data = event.data;
    if (!data || data.source !== CONTENT_SOURCE || !data.requestId) { return; }
    let payload;
    try {
      if (data.type === "M365CE_BRIDGE_TEST_SUBSTRATE") { payload = await handleTestSubstrate(data.payload || {}); }
      else if (data.type === "M365CE_BRIDGE_GET_RAW_JSON_MARKDOWN") { payload = await handleRawJsonMarkdown(data.payload || {}); }
      else if (data.type === "M365CE_BRIDGE_GET_EXPORT_FILES") { payload = await handleExportFiles(data.payload || {}); }
      else if (data.type === "M365CE_BRIDGE_GET_LAST_CAPTURED") { payload = lastCapturedConversation || { ok: false, error: "No GetConversation response observed yet" }; }
      else { payload = { ok: false, error: `Unknown bridge request type: ${data.type}` }; }
    } catch (error) {
      payload = { ok: false, error: error?.message || String(error), stack: error?.stack || null };
    }
    window.postMessage({ source: BRIDGE_SOURCE, requestId: data.requestId, payload }, window.location.origin);
  });

  installFetchHook();
  installXhrHook();
  window.postMessage({ source: BRIDGE_SOURCE, type: "M365CE_BRIDGE_READY", payload: { ok: true } }, window.location.origin);
})();
