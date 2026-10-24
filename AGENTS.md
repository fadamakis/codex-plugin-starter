# Working on this starter

- Keep the sample independent of any organization, private service, or account.
- Use `@openai/apps-sdk-ui` controls and host theme variables. Keep custom CSS focused on layout.
- Treat tool results and note text as data. Render text through React; do not inject HTML.
- Keep MCP stdout reserved for protocol messages. Send diagnostics to stderr.
- Keep tools useful without the UI. Validate inputs and describe writes accurately.
- After behavior changes, run `npm run check` and the affected browser tests.
- Rebuild and inspect `npm run package` before distributing. Never edit installed plugin caches.
- Update the getting-started guide when commands, names, or package paths change.
- Use current official OpenAI documentation for plugin and SDK changes.
