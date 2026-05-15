# M365 Copilot Chat Conversation Exporter Extension v1.0.37

Tightens chat-history navigation, toolbar badge accuracy, and low-value internal record filtering.

## What it does

The extension exports the currently open Microsoft 365 Copilot Chat as readable Markdown with a raw JSON Markdown companion backup.

## Load locally for the extension

For unpacked installation, load the extension from the `app` folder using your browser's extension developer tools.

1. Open your browser's extensions page.
2. Enable developer mode.
3. Choose **Load unpacked**.
4. Select the `app` folder from the extracted release package.
5. Refresh the Microsoft 365 Copilot Chat tab after loading or updating the extension.

## Source and support

Source and issue reporting are available from the public extension repository.

## Notes

- The **Open Microsoft 365 Copilot Chat** action now opens the chat history listing.
- The toolbar **ON** badge now appears only for a specific chat URL after the extension bridge has connected.
- Internal ModelSelector records are treated as known low-value metadata and excluded from readable Markdown fallback blocks.
- No export-format or data-handling behaviour changes.
