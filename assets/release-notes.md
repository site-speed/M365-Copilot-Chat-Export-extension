# M365 Copilot Chat Conversation Exporter Extension v1.0.30

Adds the extension icon set and records the first Edge Add-ons submission identifiers for future update submissions.

## What it does

The extension exports the currently open Microsoft 365 Copilot Chat conversation as readable Markdown with a raw JSON Markdown companion backup.

## Load locally for the extension

Load the unpacked extension from `public/extension/app` during local testing, or use the packaged ZIP produced by `bun run package:edge-extension` for Edge Add-ons submission.

## Source and support

Source and issue reporting are available from the public extension repository.

## Notes

- Adds robot/download-themed extension icons to the runtime package and manifest.
- Adds generated Edge Add-ons identity metadata under `dist/edge-extension/EDGE_ADDONS_IDENTITY.md`.
- No export-format or data-handling behaviour changes.
