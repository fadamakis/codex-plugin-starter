import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import { OpenAIExtensions } from '@openai/mcp-extensions/app';
import manifest from '../../plugin.json';
import { createNotebook, readSnapshot, type Snapshot, type ToolName } from '../shared/notebook';

export interface NotebookBridge {
  preview: boolean;
  subscribe(listener: (snapshot: Snapshot) => void): () => void;
  connect(): Promise<void>;
  call(name: ToolName, args: Record<string, unknown>): Promise<Snapshot>;
  close(): void;
}

export function hostBridge(): NotebookBridge {
  const app = new App({ name: manifest.name, version: manifest.version });
  new OpenAIExtensions(app);
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
    close() { void app.close(); listeners.clear(); },
  };
}

// Development-only transport. The production build removes this branch and seed adapter.
export function previewBridge(): NotebookBridge {
  const notebook = createNotebook();
  const listeners = new Set<(snapshot: Snapshot) => void>();
  return {
    preview: true,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async connect() { listeners.forEach(listener => listener(notebook.snapshot())); },
    async call(name, args) {
      const snapshot = name === 'notebook_create' ? notebook.create(args)
        : name === 'notebook_update' ? notebook.update(args)
        : name === 'notebook_favorite' ? notebook.favorite(args) : notebook.snapshot();
      listeners.forEach(listener => listener(snapshot));
      return snapshot;
    },
    close() { listeners.clear(); },
  };
}
