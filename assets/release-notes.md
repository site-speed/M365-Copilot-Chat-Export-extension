# M365 Copilot Chat Conversation Exporter Extension v1.0.22

Documentation correction for the browser extension public release notes.

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

- Targets M365 Copilot Chat for Microsoft 365 work/school accounts.
- Runs locally in the browser using the existing authenticated session.
- Exported `.md`, `.json.md`, and `.diagnostic.json.md` files may contain sensitive work data and should be handled carefully.
- v1.0.22 has no browser extension runtime changes.
- v1.0.22 restores this public release-note structure for future extension releases.
