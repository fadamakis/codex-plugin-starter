import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import { OpenAIExtensions } from '@openai/mcp-extensions/app';
import manifest from '../../plugin.json';
import { createMemoryNoteStore, createNotebook, readSnapshot, sampleNotes, snapshotSchema, type Snapshot, type ToolName } from '../shared/notebook';

export interface NotebookBridge {
  preview: boolean;
  subscribe(listener: (snapshot: Snapshot) => void): () => void;
  connect(): Promise<void>;
  call(name: ToolName, args: Record<string, unknown>): Promise<Snapshot>;
  sendMessage(prompt: string): Promise<boolean>;
  close(): void;
}

export function hostBridge(): NotebookBridge {
  const app = new App({ name: manifest.name, version: manifest.version });
  const extensions = new OpenAIExtensions(app);
  const listeners = new Set<(snapshot: Snapshot) => void>();
  const publish = (snapshot: Snapshot) => { listeners.forEach(listener => listener(snapshot)); return snapshot; };
  function applyContext() {
    const context = app.getHostContext();
    if (context?.theme) applyDocumentTheme(context.theme);
    if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      document.documentElement.style.setProperty(`--safe-${side}`, `${context?.safeAreaInsets?.[side] ?? 0}px`);
    }
  }
  app.onhostcontextchanged = applyContext;
  // Register before connecting: the host sends the entrypoint's initial result.
  app.ontoolresult = result => {
    try { publish(readSnapshot(result)); }
    catch { /* A failed tool result must not overwrite the last valid view. */ }
  };
  return {
    preview: false,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async connect() {
      if (window.parent === window) throw new Error('Open the built plugin in Codex, or use npm run dev for the browser preview.');
      await app.connect();
      applyContext();
    },
    async call(name, args) { return publish(readSnapshot(await app.callServerTool({ name, arguments: args }))); },
    async sendMessage(prompt) {
      const message = extensions.message;
      if (!app.getHostCapabilities()?.message?.text && !message) return false;
      const params = { role: 'user' as const, content: [{ type: 'text' as const, text: prompt }] };
      const result = message ? await message.send(params) : await app.sendMessage(params);
      if (result.isError) throw new Error('Codex could not accept the message. Try again or copy the prompt.');
      return true;
    },
    close() { void app.close(); listeners.clear(); },
  };
}

// Development-only transport. Preview data stays separate from the installed plugin.
export function previewBridge(): NotebookBridge {
  let notebook: ReturnType<typeof createNotebook> | undefined;
  function getNotebook() {
    if (!notebook) {
      try {
        const key = `${manifest.name}:browser-preview`;
        const saved = localStorage.getItem(key);
        const initial = saved ? snapshotSchema.parse(JSON.parse(saved)).notes : sampleNotes();
        notebook = createNotebook(undefined, createMemoryNoteStore(initial, notes => {
          localStorage.setItem(key, JSON.stringify({ notes }));
        }));
      } catch {
        throw new Error('Could not read saved preview notes. Check local storage in this browser.');
      }
    }
    return notebook;
  }
  const listeners = new Set<(snapshot: Snapshot) => void>();
  return {
    preview: true,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async connect() { const snapshot = getNotebook().snapshot(); listeners.forEach(listener => listener(snapshot)); },
    async call(name, args) {
      const notebook = getNotebook();
      const snapshot = name === 'notebook_create' ? notebook.create(args)
        : name === 'notebook_update' ? notebook.update(args)
        : name === 'notebook_favorite' ? notebook.favorite(args) : notebook.snapshot();
      listeners.forEach(listener => listener(snapshot));
      return snapshot;
    },
    async sendMessage() { return false; },
    close() { listeners.clear(); },
  };
}
