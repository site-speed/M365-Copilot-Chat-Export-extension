# M365 Copilot Chat Conversation Exporter Extension v1.0.28

Documentation and metadata-only update for the browser extension.

## What it does

Exports the current Microsoft 365 work/school Copilot Chat conversation as:

- readable Markdown
- raw JSON companion Markdown
- diagnostic JSON Markdown when troubleshooting is needed

## Load locally

Load the extension runtime folder as an unpacked extension:

```text
public/extension/app
```

After reloading the extension, refresh the Microsoft 365 Copilot Chat tab so the latest content scripts are active.

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

- No extension export-format or runtime behaviour changes.
- Keeps the v1.0.26 Substrate URL hardening: passive network hooks use URL parsing and exact `substrate.office.com` hostname checks.
- Exported files may contain sensitive work data and should be handled carefully.
