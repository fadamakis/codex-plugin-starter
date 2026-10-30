# Notebook 0.1.3 verification

On October 25, 2026, the maintainer confirmed both checks in the Codex desktop app with the locally installed 0.1.3 build:

- A saved note survives reopening Notebook.
- **Work on this with Codex** sends the selected note to the conversation.

Local automated checks passed: 10 unit tests, 14 browser tests, type checking, production build, manifest validation, and packaging. The packaged MCP server also passed tests for writes from two server processes and persistence after restarting them.

The recording plan is to show the selected note reaching Codex, discuss a plan, save it as a new draft with Notebook's tools, and show that draft beside the original.

The tagged GitHub Actions workflow checks the release on Linux, macOS, and Windows before publishing the prebuilt marketplace and ZIP.
