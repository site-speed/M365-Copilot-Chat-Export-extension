# M365 Copilot Chat Conversation Exporter Extension v1.0.27

Documentation and release-metadata sync update for the browser extension.

## What it does

Exports the current Microsoft 365 work/school Copilot Chat conversation as:

- readable Markdown
- raw JSON companion Markdown
- diagnostic JSON companion Markdown when troubleshooting is needed

The readable Markdown is designed for human review, project handoff, and future conversation rehydration. The raw JSON companion remains the complete local backup.

## Load locally

Load the extension runtime folder as an unpacked Edge/Chromium extension:

```text
app
```

After loading or refreshing the extension, reload the Microsoft 365 Copilot Chat tab before exporting.

## Source and support

Source:

```text
https://github.com/site-speed/M365-Copilot-Chat-Export-extension
```

Issues:

```text
https://github.com/site-speed/M365-Copilot-Chat-Export-extension/issues
```

## Notes

- Fixes public README version metadata so release checks recognise the current extension version.
- Keeps the v1.0.26 Substrate URL hardening: page-world and renderer network hooks use URL parsing and exact `substrate.office.com` hostname checks.
- No export-format or runtime behaviour changes beyond version/metadata alignment.
- Exported `.md`, `.json.md`, and `.diagnostic.json.md` files may contain sensitive work data and should be handled carefully.
