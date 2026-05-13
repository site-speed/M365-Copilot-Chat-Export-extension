# M365 Copilot Chat Conversation Exporter — Browser Extension

Version: **v1.0.20**

Export Microsoft 365 Copilot Chat conversations as readable Markdown with a raw JSON companion.

## Screenshot

![M365 Copilot Chat Conversation Exporter extension popup](assets/screenshot-extension-popup.png)

## Repository layout

The loadable Edge/Chromium Manifest V3 extension runtime lives in:

```text
public/extension/app
```

## Release notes

Current public release notes are maintained at:

```text
assets/release-notes.md
```

The filename is stable so GitHub releases can use the same `gh release create ... --notes-file assets/release-notes.md` pattern for every version.

## Privacy

Exports are produced from the authenticated browser session and may contain sensitive organisation data.

## Licence

MIT License. Copyright 2026 Tim Moss.
