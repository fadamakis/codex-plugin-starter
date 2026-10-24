# Make a reading list

Once Notebook works in the Codex sidebar, you can replace it with something useful for your own workflow. A reading list is one option.

We can keep the sidebar, cards, search, favorites, and editor. Each card will show an article instead of a note.

Start in `src/shared/notebook.ts`. Instead of a note with a body and kind, define a reading item:

```ts
const readingItemInput = z.object({
  title: z.string().trim().min(1),
  url: z.url(),
  status: z.enum(['to-read', 'reading', 'finished']),
});
```

Keep the ID, favorite flag, and timestamp. Update the data model to create, edit, and favorite reading items. You'll need to make these changes yourself. The starter still contains the Notebook example.

Next, update the tools in `src/server/index.ts`. Rename them to `reading_open`, `reading_create`, `reading_update`, and `reading_favorite`. Update their input schemas and descriptions too. Codex uses these descriptions to decide when to call each tool.

Update the matching calls in `src/app/bridge.ts`, including the browser preview code. Update the shared types to use the new tool names.

Update `src/app/work-with-codex.ts` so the prompt includes the article title, URL, and reading status instead of the old note fields.

Finally, adapt `src/app/Notebook.tsx`. Replace the note's body field with a URL input and the kind picker with a reading-status control. Show a link and status on each card. Most of the search and favorite behavior can stay.

The OpenAI UI library provides the controls. You can focus on what the plugin does.

Set your plugin's name and author with the configuration script:

```bash
npm run configure -- \
  --name reading-list \
  --display-name "Reading List" \
  --author "Your Name" \
  --repository your-account/reading-list

npm install --package-lock-only
```

The script updates the names in the package, plugin, MCP, and marketplace files. Also review the descriptions, icons, default prompt, and sample skill.

See the [customization guide](https://github.com/fadamakis/codex-plugin-starter/blob/main/docs/build-your-plugin.md) for the complete file-by-file process.

