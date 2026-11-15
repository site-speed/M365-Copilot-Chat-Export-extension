# M365 Copilot Chat Conversation Exporter (Extension) v1.0.43

Supports the redirected Microsoft 365 Copilot Chat web address, `copilot.cloud.microsoft`.

## What it does

Exports Microsoft 365 Copilot Chat conversations to:

- Readable Markdown (.md)
- Raw JSON Markdown (.json.md)

## Improvements

- Works on `copilot.cloud.microsoft` after the Microsoft 365 Copilot web URL change, including chats that open at the site root.
- Keeps support for `m365.cloud.microsoft`, `microsoft365.com`, and `www.microsoft365.com` so tenants that have not been redirected still work.
- Treats only URLs that carry a real conversation identifier as an exportable chat, so unrelated query parameters no longer make a non-chat page look exportable.
- Detects the conversation download call when it is served from the app's own `*.cloud.microsoft` host.
- Personal Copilot (`copilot.microsoft.com`) remains outside this tool's scope.

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

- Supports the Microsoft 365 Copilot web URL redirect from the August–November 2026 rollout.
- If the toolbar badge stays off, reload the Copilot Chat tab once after installing or updating the extension.
- The store update for this version is submitted separately; local unpacked installs can use this release immediately.
- Exported files may contain sensitive work data and should be handled carefully.
