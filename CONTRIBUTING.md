# Contributing

Keep the starter small, understandable, and independent of private systems. Changes should help someone build their own plugin, rather than turn the sample into a larger product.

1. Create a branch and install dependencies with `npm ci`.
2. Make the focused change. Add behavior tests for changed tool logic or interactions.
3. Run `npm run check`, `npm run test:ui`, and `npm run package`.
4. Explain the behavior, verification, and compatibility impact in the pull request.

Use synthetic fixtures. Never include credentials, user data, or material you do not have permission to redistribute. Update docs when changing commands or package paths. The maintainer handles version tags and releases.
