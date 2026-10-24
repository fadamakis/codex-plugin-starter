---
name: open-notebook
description: Open the sample Notebook plugin, read its notes, or create a note when the user asks to use Notebook. Use the installed notebook MCP tools; do not invent notes or claim changes without a tool result.
---

# Use Notebook

1. Resolve the installed `notebook_open` tool from the available tool catalog and call it to show the current notebook.
2. For a requested new note, use `notebook_create` with the user's title, content, and an appropriate kind: `idea`, `draft`, or `reference`.
3. Use `notebook_update` or `notebook_favorite` only when the user requests that change. Read the current note IDs first; never guess them.
4. Report the result returned by the tool. If the plugin is unavailable, explain the missing installation or connection instead of pretending to run it.

This sample stores synthetic notes in memory. Notes reset when the MCP server restarts. It reads no user files, connects to no external service, and creates no schedules.

When adapting this starter, replace these instructions together with the server tool names and sample behavior.
