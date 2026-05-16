let lastDiagnostic = null;
const POPUP_SETTINGS_KEY = "m365ce_extension_popup_settings_v1";
let reloadAutoRefreshTimer = null;
let reloadAutoRefreshInFlight = false;
function isoTimestampForFilename(date = new Date()) { return date.toISOString().replace("T", "_").replace(/:/g, "-"); }
function sanitizeFilenamePart(value) { const raw = String(value || "m365-copilot-extension-output"); const safe = raw.replace(new RegExp("[\\x00-\\x1F<>:\"/\\\\|?*]+", "g"), " ").replace(/\s+/g, " ").trim(); return (safe || "m365-copilot-extension-output").slice(0, 160).replace(/[ .]+$/g, "") || "m365-copilot-extension-output"; }
function longestFenceRun(text, marker) { const matches = String(text || "").match(new RegExp(`${marker}{3,}`, "g")) || []; return matches.reduce((max, item) => Math.max(max, item.length), 0); }
function renderFencedBlock(text, language = "") { const body = String(text ?? ""); const backtickLength = Math.max(3, longestFenceRun(body, "`") + 1); const fence = "`".repeat(backtickLength); return `${fence}${language}\n${body}\n${fence}`; }
function extensionVersion() { return chrome.runtime.getManifest()?.version || "1.0.40"; }
function diagnosticJsonMarkdown(diagnostic, exportedAt = new Date().toISOString()) { return [`## M365 Copilot Chat Conversation Exporter diagnostic`, `- Exported: ${exportedAt}`, `- ExporterVersion: ${extensionVersion()}`, `- ExporterRuntime: browser-extension`, "", renderFencedBlock(JSON.stringify(diagnostic, null, 2), "json"), ""].join("\n"); }
function setText(id, value) { const element = document.getElementById(id); if (element) { element.textContent = value; } }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch])); }
function showVersion() { setText("extension-version", `v${extensionVersion()}`); }
function loadPopupSettings() { try { return { includeUnclassifiedRecords: true, ...(JSON.parse(localStorage.getItem(POPUP_SETTINGS_KEY) || "{}") || {}) }; } catch { return { includeUnclassifiedRecords: true }; } }
function savePopupSettings(settings) { try { localStorage.setItem(POPUP_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } }
function exportOptionsFromUi() { const checkbox = document.getElementById("include-unclassified-records"); return { includeUnclassifiedRecords: checkbox ? checkbox.checked : true }; }
function hydrateOptionsUi() { const settings = loadPopupSettings(); const checkbox = document.getElementById("include-unclassified-records"); if (!checkbox) { return; } checkbox.checked = settings.includeUnclassifiedRecords !== false; checkbox.addEventListener("change", () => savePopupSettings(exportOptionsFromUi())); }
function appendPopupLine(parent, text, className = "") { const line = document.createElement("div"); if (className) { line.className = className; } line.textContent = text; parent.appendChild(line); return line; }
const M365_COPILOT_CHAT_URL = "https://m365.cloud.microsoft/chat/all";
let lastActiveTabInfo = null;
function urlHost(url) { try { return new URL(String(url || "")).hostname.toLowerCase(); } catch { return ""; } }
function inferChatIdFromUrl(url) { try { const parsed = new URL(String(url || "")); const pathConversationMatch = parsed.pathname.match(/(?:^|\/)conversation\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:$|\/)/); if (pathConversationMatch) { return pathConversationMatch[1]; } for (const key of ["conversationId", "chatId", "cid", "id"]) { const value = parsed.searchParams.get(key); if (value) { return value; } } const uuidMatch = String(url || "").match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/); return uuidMatch ? uuidMatch[0] : null; } catch { return null; } }
function isSupportedM365CopilotUrl(url) { try { const parsed = new URL(String(url || "")); const host = parsed.hostname.toLowerCase(); return (host === "m365.cloud.microsoft" || host === "microsoft365.com" || host === "www.microsoft365.com") && parsed.pathname.includes("/chat"); } catch { return false; } }
function isPersonalCopilotUrl(url) { return urlHost(url) === "copilot.microsoft.com"; }
function hasSpecificChatInUrl(url) { return Boolean(inferChatIdFromUrl(url)); }
function isMissingReceiverError(errorText) { return /could not establish connection|receiving end does not exist/i.test(String(errorText || "")); }
function setExportEnabled(enabled) { const button = document.getElementById("export-current"); if (button) { button.disabled = !enabled; } }
function setExportVisible(visible) { const panel = document.getElementById("export-actions"); if (panel) { panel.hidden = !visible; } }
function setRecoveryActions(visible, options = {}) { const panel = document.getElementById("recovery-actions"); const text = document.getElementById("recovery-message"); const reloadButton = document.getElementById("reload-tab"); const openButton = document.getElementById("open-m365-chat"); if (!panel) { return; } const message = options.message || ""; panel.hidden = !visible; if (text) { text.textContent = message; text.hidden = !message; } if (reloadButton) { reloadButton.hidden = !Boolean(options.showReload); } if (openButton) { openButton.hidden = !Boolean(options.showOpen); } }
function renderUnsupportedOrDisconnectedInfo(info, panel) {
  const tabUrl = info?.tabUrl || lastActiveTabInfo?.url || "";
  const supportedUrl = info?.supportedUrl || isSupportedM365CopilotUrl(tabUrl);
  const personalCopilotUrl = info?.personalCopilotUrl || isPersonalCopilotUrl(tabUrl);
  const specificChatUrl = info?.specificChatUrl || hasSpecificChatInUrl(tabUrl);
  setExportEnabled(false);
  setExportVisible(true);
  if (info?.errorCode === "content-script-unavailable" && supportedUrl && specificChatUrl) {
    appendPopupLine(panel, "The exporter is not connected to this chat tab yet.", "bad");
    appendPopupLine(panel, "If you have just installed or updated the extension, reload this tab once, then open the extension again.", "muted");
    setExportVisible(false);
    setRecoveryActions(true, { showReload: true });
    return;
  }
  if (personalCopilotUrl) {
    appendPopupLine(panel, "This tab appears to be personal Copilot, not Microsoft 365 Copilot Chat.", "bad");
    appendPopupLine(panel, "Personal Copilot support is not enabled in this release. Use Microsoft 365 Copilot Chat and select an existing saved chat.", "muted");
    setRecoveryActions(true, { showOpen: true });
    return;
  }
  if (!supportedUrl) {
    appendPopupLine(panel, "Open Microsoft 365 Copilot Chat to use this exporter.", "bad");
    appendPopupLine(panel, "After the page opens, select an existing saved chat from chat history, then open the extension again.", "muted");
    setRecoveryActions(true, { showOpen: true });
    return;
  }
  appendPopupLine(panel, "No saved chat selected yet.", "bad");
  appendPopupLine(panel, "If this is a brand-new chat, send a message, and wait for it to appear in chat history.", "muted");
  appendPopupLine(panel, "Or open an existing chat from history.", "muted");
}
function renderPageInfo(info) { const panel = document.getElementById("page-info"); if (!panel) { return; } panel.textContent = ""; setRecoveryActions(false); setExportVisible(true); if (!info?.ok) { renderUnsupportedOrDisconnectedInfo(info, panel); return; } const state = info.active ? "Ready" : "Open Microsoft 365 Copilot Chat"; const stateLine = appendPopupLine(panel, state, info.active ? "ok" : "bad"); const strong = document.createElement("strong"); strong.className = stateLine.className; strong.textContent = state; stateLine.textContent = ""; stateLine.appendChild(strong); const title = info.chatName || info.title || "not detected"; appendPopupLine(panel, `Chat: ${title}`, "muted"); appendPopupLine(panel, `ConversationId: ${info.conversationId || "not detected"}`, "muted"); if (!info.active || !info.conversationId) { appendPopupLine(panel, "No saved chat selected yet. If this is a brand-new chat, send a message, and wait for it to appear in chat history.", "muted"); appendPopupLine(panel, "Or open an existing chat from history.", "muted"); setExportEnabled(false); return; } setExportEnabled(true); }
async function activeTab() { const tabs = await chrome.tabs.query({ active: true, currentWindow: true }); lastActiveTabInfo = tabs[0] || null; return lastActiveTabInfo; }
async function sendToActiveTab(message) { const tab = await activeTab(); if (!tab?.id) { return { ok: false, error: "No active tab", errorCode: "no-active-tab" }; } try { return await chrome.tabs.sendMessage(tab.id, message); } catch (error) { const errorText = error?.message || String(error); const missingReceiver = isMissingReceiverError(errorText); const tabUrl = tab.url || ""; return { ok: false, error: missingReceiver ? "The exporter is not connected to this tab yet." : errorText, rawError: errorText, errorCode: missingReceiver ? "content-script-unavailable" : "message-failed", tabUrl, supportedUrl: isSupportedM365CopilotUrl(tabUrl), personalCopilotUrl: isPersonalCopilotUrl(tabUrl), specificChatUrl: hasSpecificChatInUrl(tabUrl) }; } }
function stopReloadAutoRefresh() { if (reloadAutoRefreshTimer) { clearInterval(reloadAutoRefreshTimer); reloadAutoRefreshTimer = null; } reloadAutoRefreshInFlight = false; }
function startReloadAutoRefresh() {
  stopReloadAutoRefresh();
  const startedAt = Date.now();
  const maxWaitMs = 30000;
  const pollDelayMs = 1250;
  let attempt = 0;
  setText("result", "Reloading this tab. Waiting for the exporter connection to come back…");
  const poll = async () => {
    if (reloadAutoRefreshInFlight) { return; }
    reloadAutoRefreshInFlight = true;
    attempt += 1;
    try {
      const info = await refreshPageInfo(true);
      if (info?.ok && info.active && info.conversationId) {
        stopReloadAutoRefresh();
        setText("result", "Connected. The exporter is ready for this chat.");
        return;
      }
      if (Date.now() - startedAt >= maxWaitMs) {
        stopReloadAutoRefresh();
        setText("result", "Still waiting for the exporter connection. If the page has finished loading, use Refresh page info or reopen the extension.");
        return;
      }
      setText("result", `Waiting for the exporter connection… (${attempt})`);
    } finally {
      reloadAutoRefreshInFlight = false;
    }
  };
  reloadAutoRefreshTimer = setInterval(poll, pollDelayMs);
  setTimeout(poll, pollDelayMs);
}
async function reloadActiveTab() { const tab = await activeTab(); if (!tab?.id) { setText("result", "No active tab to reload."); return; } setText("result", "Reloading this tab. The popup will refresh automatically when the exporter reconnects."); await chrome.tabs.reload(tab.id); startReloadAutoRefresh(); }
async function openM365CopilotChat() { await chrome.tabs.create({ url: M365_COPILOT_CHAT_URL, active: true }); }
function downloadTextFromPopup(filename, text, mimeType = "text/markdown;charset=utf-8") { const safeFilename = sanitizeFilenamePart(filename); const blob = new Blob([text], { type: mimeType }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = safeFilename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); return { ok: true, filename: safeFilename }; }
function downloadMultipleTextFromPopup(files) { const results = []; for (const file of files || []) { results.push(downloadTextFromPopup(file.filename, file.text, file.mimeType || "text/markdown;charset=utf-8")); } return results; }
function showDiagnostic(payload) { lastDiagnostic = { capturedAt: new Date().toISOString(), result: payload }; setText("result", JSON.stringify(payload, null, 2)); }
async function refreshPageInfo(render = true) { const info = await sendToActiveTab({ type: "M365CE_GET_PAGE_INFO" }); if (info?.ok && info.active && info.conversationId) { const summary = await sendToActiveTab({ type: "M365CE_TEST_SUBSTRATE" }); if (summary?.ok) { info.chatName = summary.chatName || summary.title || info.chatName; } } if (render) { renderPageInfo(info); } return info; }
async function exportCurrentConversation() { const button = document.getElementById("export-current"); const oldText = button.textContent; let keepDisabled = false; button.disabled = true; button.textContent = "Exporting…"; setText("result", "Exporting readable Markdown and raw JSON Markdown…"); try { const result = await sendToActiveTab({ type: "M365CE_GET_EXPORT_FILES", options: exportOptionsFromUi() }); if (!result?.ok) { keepDisabled = true; renderPageInfo(result); showDiagnostic(result); return; } const downloads = downloadMultipleTextFromPopup(result.files || []); setText("result", JSON.stringify({ ok: true, exportedAt: result.exportedAt, downloads, summary: result.summary, rendererVersion: result.rendererVersion, options: exportOptionsFromUi() }, null, 2)); } finally { button.disabled = keepDisabled; button.textContent = oldText; } }
async function downloadDiagnosticBundle() { const exportedAt = new Date().toISOString(); const timestamp = isoTimestampForFilename(new Date(exportedAt)); const bundle = { ok: true, exportedAt, extensionVersion: extensionVersion(), exporterRuntime: "browser-extension", popupOptions: exportOptionsFromUi() }; setText("result", "Preparing diagnostic bundle…"); bundle.pageInfo = await refreshPageInfo(true); bundle.substrateTest = await sendToActiveTab({ type: "M365CE_TEST_SUBSTRATE" }); bundle.observedCapture = await sendToActiveTab({ type: "M365CE_GET_LAST_CAPTURED" }); lastDiagnostic = { capturedAt: exportedAt, result: bundle }; const baseName = sanitizeFilenamePart(bundle.substrateTest?.chatName || bundle.substrateTest?.conversationId || bundle.pageInfo?.conversationId || "m365-copilot-extension-diagnostic"); const filename = `${baseName}_${timestamp}.diagnostic.json.md`; const download = downloadTextFromPopup(filename, diagnosticJsonMarkdown(lastDiagnostic, exportedAt), "text/markdown;charset=utf-8"); setText("result", JSON.stringify({ ok: true, download, bundle }, null, 2)); }
document.getElementById("refresh-page").addEventListener("click", () => { stopReloadAutoRefresh(); refreshPageInfo(true); });
document.getElementById("reload-tab").addEventListener("click", reloadActiveTab);
document.getElementById("open-m365-chat").addEventListener("click", openM365CopilotChat);
document.getElementById("export-current").addEventListener("click", exportCurrentConversation);
document.getElementById("download-diagnostic-bundle").addEventListener("click", downloadDiagnosticBundle);
showVersion();
hydrateOptionsUi();
refreshPageInfo();

window.addEventListener("unload", stopReloadAutoRefresh);
