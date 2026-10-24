# Installation and updates

## Requirements

- Node.js 22.13 or newer. Development also needs npm.
- A current Codex desktop app for the interactive sidebar. OpenAI's entrypoint guidance identifies desktop build `26.928.20710` as the minimum for these extension APIs; prefer the current release.
- Codex CLI with plugin marketplace commands for the command examples below.

The browser preview needs no Codex installation. Standard MCP tools can run headlessly in a compatible client. The sidebar requires host support for OpenAI global entrypoints. A local stdio server is not a web or mobile backend.

## Supported systems and verification

| Surface | Coverage |
| --- | --- |
| Build, packaging, and stdio tools | Linux, macOS, and Windows with Node 22; checked in CI |
| Browser preview | Chromium tests at desktop, tablet, and phone widths, in light and dark themes |
| Codex sidebar | Requires a desktop host supporting global MCP app entrypoints; the official AppBridge is tested automatically |
| Web and mobile hosts | The local Node server requires a local executor; no hosted backend is included |

CI does not exercise the native desktop sidebar. Verify activation in your target Codex app before claiming support for a derived plugin.

## Install a local build

```sh
npm ci
npm run check
npm run package
codex plugin marketplace add ./artifacts/plugin
codex plugin add notebook@codex-plugin-starter
```

Use your configured names after adapting the template. Open a new chat if newly installed tools do not appear. Open Notebook from the sidebar in a supported desktop app.

## Install the published example

After a successful tagged release:

```sh
codex plugin marketplace add fadamakis/codex-plugin-starter --ref releases
codex plugin add notebook@codex-plugin-starter
```

The `releases` branch contains built packages. The `main` branch contains source.

## Update

```sh
codex plugin marketplace upgrade codex-plugin-starter
codex plugin add notebook@codex-plugin-starter
codex plugin list --json
```

The first command refreshes the marketplace snapshot. The second installs the selected package. Check the installed version in the listing and reopen the plugin panel; restart the desktop app if it still serves an older process or UI. The panel's version badge identifies its loaded build. Automatic refresh timing can vary by client; this starter promises no background update schedule.

For a local rebuild, repeat packaging and the supported installation flow. Editing an installed cache does not update the source repository.

## Remove

```sh
codex plugin remove notebook@codex-plugin-starter
```

This example keeps no persistent user database. A plugin you derive from it must document its own storage and deletion policy.

See [Codex plugin commands](https://learn.chatgpt.com/docs/cli/reference) and [MCP Extensions patterns](https://github.com/openai/mcp-extensions/blob/main/docs/patterns.md).
