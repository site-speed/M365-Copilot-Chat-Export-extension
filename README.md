# M365 Copilot Chat Conversation Exporter — Browser Extension

<!-- start user badges -->
![PRs opened in last 30 days](https://img.shields.io/badge/PRs%20opened%20in%20last%2030%20days-0-green?labelColor=555) ![PRs closed in last 30 days](https://img.shields.io/badge/PRs%20closed%20in%20last%2030%20days-0-red?labelColor=555) ![Open PRs](https://img.shields.io/badge/Open%20PRs-0-blue?labelColor=555)

![Issues opened in last 30 days](https://img.shields.io/badge/Issues%20opened%20in%20last%2030%20days-0-green?labelColor=555) ![Issues closed in last 30 days](https://img.shields.io/badge/Issues%20closed%20in%20last%2030%20days-0-red?labelColor=555) ![Open issues](https://img.shields.io/badge/Open%20issues-0-blue?labelColor=555)

![Lines added (last 30 days)](https://img.shields.io/badge/Lines%20added%20(last%2030%20days)-95-green?labelColor=555) ![Lines deleted (last 30 days)](https://img.shields.io/badge/Lines%20deleted%20(last%2030%20days)-9-red?labelColor=555) ![Commits in last 30 days](https://img.shields.io/badge/Commits%20in%20last%2030%20days-3-blue?labelColor=555)

![Contributors (unique)](https://img.shields.io/badge/Contributors%20(unique)-1-blue?labelColor=555) ![Active contributors (last 30d)](https://img.shields.io/badge/Active%20contributors%20(last%2030d)-1-blue?labelColor=555)
<!-- end user badges -->

Version: **v1.0.40**

Export Microsoft 365 Copilot Chat as readable Markdown and raw JSON.

## What it does

This Manifest V3 browser extension exports the current Microsoft 365 Copilot Chat from an authenticated browser session.

The extension is intended for Edge/Chromium-compatible browsers. It is available from Microsoft Edge Add-ons, with unpacked loading still available for local testing or manual installation.

## Screenshot

![M365 Copilot Chat Conversation Exporter extension popup](assets/screenshot-extension-popup.png)

## Output files

The extension can generate:

1. readable Markdown (`.md`) for human review and handoff;
2. raw JSON Markdown (`.json.md`) as the complete local backup;
3. diagnostic JSON Markdown (`.diagnostic.json.md`) when troubleshooting is needed.

## Install from Microsoft Edge Add-ons

Install the released extension from Microsoft Edge Add-ons:

```text
https://microsoftedge.microsoft.com/addons/detail/bfgemlnkhckcdkndiemkahojkbdbpmpm
```

## Load locally

Load the extension runtime folder as an unpacked extension:

```text
app
```

After reloading the extension, refresh the Microsoft 365 Copilot Chat tab so the latest content scripts are active.

## Usage

1. Open a Microsoft 365 Copilot Chat.
2. Open the extension popup from the browser toolbar.
3. Confirm the popup shows the expected chat title and ConversationId.
4. Click the export button.
5. Keep the generated Markdown and raw JSON Markdown files together.

## Current behaviour

- Shows the active chat title and ConversationId in the popup.
- Exports readable Markdown plus a raw JSON Markdown companion.
- Uses filesystem-safe timestamped filenames.
- Keeps troubleshooting and diagnostic controls available but secondary.
- Includes an option to include unclassified records for deeper troubleshooting.

## Permissions

The extension requests browser permissions needed to read the active Microsoft 365 Copilot Chat page and trigger local downloads. Host permissions are scoped to Microsoft 365 Copilot and related Microsoft 365/Substrate endpoints used by the exporter.

## Source and support

Source:

```text
https://github.com/site-speed/M365-Copilot-Chat-Export-extension
```

Issues:

```text
https://github.com/site-speed/M365-Copilot-Chat-Export-extension/issues
```

## Privacy and data handling

Exports are produced from the authenticated browser session and may contain sensitive organisation data, prompts, responses, citations, file names, and tool traces.

Treat `.md`, `.json.md`, and `.diagnostic.json.md` files as private unless reviewed and deliberately shared.

## Limitations

- Microsoft 365 Copilot Chat APIs and page structure can change.
- The extension is published in Microsoft Edge Add-ons; unpacked installation remains useful for local testing and manual validation.
- Diagnostic exports are intended for troubleshooting and may contain additional technical detail.

## Release notes

Current release notes are available at:

```text
assets/release-notes.md
```

## Security

See `SECURITY.md` for supported-version and reporting guidance.

## Licence

MIT License. Copyright 2026 Tim Moss.


## Privacy policy

See [PRIVACY.md](PRIVACY.md) for the extension privacy policy. The extension is designed for local export and does not operate a backend service for uploaded conversation data.


## Extension icon

The packaged extension includes robot/download-themed PNG icons in `app/icons/` and a 300×300 listing logo in `assets/extension-logo-300.png`.
