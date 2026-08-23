# M365 Copilot Chat Conversation Exporter (Extension) v1.0.42

Repairs the observed Turn 38 Markdown corruption and closes the successful extension popup without a delay.

## What it does

Exports Microsoft 365 Copilot Chat conversations to:

- Readable Markdown (.md)
- Raw JSON Markdown (.json.md)

## Improvements

- Preserves original blank lines instead of removing every blank line during duplicate-link cleanup.
- Prevents system-status emphasis repair from pairing one paragraph's closing `**` with the next paragraph's opening `**`.
- Restricts non-adjacent outer Markdown fence promotion to Markdown-labelled wrappers, leaving ordinary `text` code blocks independent.
- Restricts split-heading continuation repair to the observed numbered/lettered `1)` / `A)` heading shape.
- Rerenders the exact issue #7 Turn 38 fixture with intact emphasis, separate headings/prose/lists, and balanced triple-backtick code blocks.
- Closes the browser action popup immediately after both download clicks are dispatched, removing the v1.0.41 overlap delay.
- Retains v1.0.41 bridge readiness, 90-second fetch/export timeout, retry, and curated metadata improvements.

## Load locally

Recommended install route:

```text
https://microsoftedge.microsoft.com/addons/detail/bfgemlnkhckcdkndiemkahojkbdbpmpm
```

For unpacked installation, load the extension from the `app` folder using your browser's extension developer tools.

1. Open your browser's extensions page.
2. Enable developer mode.
3. Choose **Load unpacked**.
4. Select the `app` folder from the extracted release package.
5. Refresh the Microsoft 365 Copilot Chat tab after loading or updating the extension.

## Source and support

https://github.com/site-speed/M365-Copilot-Chat-Export-extension

## Notes

- v1.0.42 is prepared locally and is not described as published until the release/store update completes.
- Exported files may contain sensitive work data and should be handled carefully.
