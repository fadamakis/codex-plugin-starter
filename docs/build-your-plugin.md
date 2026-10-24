# Make it yours

The notebook is a complete example, not a framework you must keep. Replace its domain and keep the pieces that serve your plugin.

## 1. Create your repository

Select **Use this template** on GitHub. Clone your new repository and run `npm ci`. Your copy starts with its own Git history.

## 2. Set its identity

```sh
npm run configure -- \
  --name my-plugin \
  --display-name "My Plugin" \
  --author "Your Name" \
  --repository your-account/my-plugin
npm install --package-lock-only
```

This updates `plugin.json`, its compatibility overlay, `mcp.json`, the marketplace, and package metadata. Preserve a stable plugin name after distributing it. Update the description, prompt, icon, README links, and sample skill to match the product you actually build. Retain the starter's MIT notice and add attribution for your contributions.

## 3. Replace the sample behavior

Start in `src/shared/notebook.ts`: the schemas define accepted inputs and returned data. `src/server/index.ts` registers those operations as MCP tools. The browser preview reuses the model through `previewBridge()`.

For each tool, give a clear description, a strict input schema, a structured result, and accurate annotations. A read-only tool must actually be read-only. Validate IDs and permissions in server code. Treat source content as data, never executable instructions.

The notebook stores sample notes in memory. For real persistence, choose storage outside the versioned plugin directory, define backups and migrations, and test multiple processes. For external services, use each user's authorized connection; never bundle tokens or personal data.

## 4. Adapt the UI

`src/app/Notebook.tsx` is the sample layout. Use OpenAI UI components for controls; use `styles.css` for your layout and visual identity. The supplied CSS has light/dark tokens, narrow layouts, reduced-motion handling, and visible focus.

Keep host interactions in `bridge.ts`. Register the initial tool-result handler **before** `app.connect()` so the first result renders immediately. Apply host theme changes and safe-area insets. Keep the development transport out of production. A failed host connection should show an actionable message, not silently switch to fake data.

For a different domain, change both server tool registrations and client calls, then replace the sample skill. Preserve a useful text/structured result for people using the tool without UI.

The sample's **Work on this with Codex** button demonstrates the reverse direction: UI to conversation. Adapt `src/app/work-with-codex.ts` to build a prompt for your own domain. Keep this user initiated, include only the selected item's context, and preserve the copyable fallback when the host does not support text messages. The host handles AI responses; the plugin does not call a model API.

## 5. Verify and package

```sh
npm run check
npx playwright install chromium
npm run test:ui
npm run package
```

Inspect `artifacts/plugin` and its ZIP. They should contain built code, manifests, icons, skill, docs, and licenses. Keep source credentials, test output, caches, and databases out. Install through the supported marketplace flow and verify the real desktop entrypoint before claiming native host compatibility.

## 6. Publish a release

Follow [the release guide](releasing.md). The workflow publishes a prebuilt `releases` branch when you push a matching version tag. Users install from that branch, not from a source tree that still needs to be built.

## Official references

- [Plugin package format](https://developers.openai.com/plugins/build/plugins)
- [Add UI to an MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)
- [OpenAI UI components](https://github.com/openai/apps-sdk-ui)
- [MCP Extensions](https://github.com/openai/mcp-extensions/tree/main/typescript)

GitHub marketplace distribution is separate from the universal public directory. A public directory listing has its own review requirements; local MCP submissions currently require approved-partner eligibility. Check the [desktop submission guidance](https://developers.openai.com/plugins/deploy/desktop-only) before planning that route.
