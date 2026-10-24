# Release your plugin

The repository has two roles: `main` contains source, and `releases` contains the prebuilt plugin that users install. Pull requests and ordinary main pushes validate without publishing a new version.

## Prepare

1. Finish your changes and update the documentation and changelog.
2. Set a new version in both package and plugin metadata:

```sh
npm run configure -- --version 0.2.0
npm install --package-lock-only
npm run check
npm run test:ui
npm run package
```

3. Inspect the ZIP, licenses, screenshots, manifests, and external-action behavior. Test native activation in the intended host. Keep a stable plugin name and document any storage migrations your real plugin adds.
4. Commit the reviewed changes and push them to your repository's `main` through your normal review process.

## Publish

Push a tag matching `plugin.json`:

```sh
git tag v0.2.0
git push origin v0.2.0
```

For the first unchanged example release, use `v0.1.0`. GitHub Actions checks types, model behavior, the production MCP server, manifests, and packaging on Linux, macOS, and Windows. Linux also runs the browser tests.

After all checks pass, the trusted tag job updates `releases` and creates a GitHub Release with the ZIP and `SHA256SUMS`. Publishing uses that repository's short-lived Actions token. It needs no personal token or OpenAI API key. The workflow uses immutable Action revisions and does not publish from fork pull requests.

A version already published from another commit is rejected. Fix a regression under a newer version instead of replacing an old release or force-updating its tag. A retry of the same source/tag can finish an interrupted publication.

## Let users install and update

Point users at the **prebuilt branch**:

```sh
codex plugin marketplace add your-account/your-repository --ref releases
codex plugin add your-plugin@your-repository
```

For updates, refresh that marketplace and install the selected plugin again. See [installation](installation.md) for activation and version verification. A data refresh inside an app does not reload its code.

Making a GitHub repository public is sufficient for this Git marketplace route; public-directory listing is a separate review process.
