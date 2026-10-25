import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { OpenAIExtensions } from '@openai/mcp-extensions/server';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import manifest from '../../plugin.json';
import { createNotebook, noteInput } from '../shared/notebook';
import { createSqliteNoteStore, notebookDataDirectory } from './storage';

const viewUri = `ui://${manifest.name}/notebook-${manifest.version}.html`;
const icon = `data:image/svg+xml;base64,${readFileSync(new URL('../../assets/icon.svg', import.meta.url)).toString('base64')}`;

export function createServer() {
  const server = new McpServer({ name: manifest.name, version: manifest.version });
  new OpenAIExtensions(server);
  const storage = createSqliteNoteStore(path.join(notebookDataDirectory(manifest.name), 'notebook.sqlite3'));
  const notebook = createNotebook(undefined, storage);
  server.server.onclose = () => storage.close();
  const result = (snapshot: ReturnType<typeof notebook.snapshot>) => ({
    content: [{ type: 'text' as const, text: `${snapshot.notes.length} notes in your notebook.` }],
    structuredContent: snapshot,
  });

  server.registerResource('Notebook view', viewUri, {
    mimeType: RESOURCE_MIME_TYPE,
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } },
  }, async () => ({ contents: [{
    uri: viewUri,
    mimeType: RESOURCE_MIME_TYPE,
    text: await readFile(new URL('../ui/index.html', import.meta.url), 'utf8'),
    _meta: {
      ui: { csp: { connectDomains: [], resourceDomains: [] } },
      'openai/ui': { preferredDisplayMode: 'fullscreen', availableDisplayModes: ['inline', 'fullscreen'] },
    },
  }] }));

  server.registerTool('notebook_open', {
    title: manifest.extensions['com.openai'].interface.displayName,
    icons: [{ src: icon, mimeType: 'image/svg+xml', sizes: ['any'] }],
    description: 'Open the notebook and read all notes saved in its local SQLite database.',
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: {
      ui: { resourceUri: viewUri },
      'openai/ui': { entrypoints: [{ type: 'global' }] },
    },
  }, async () => result(notebook.snapshot()));

  server.registerTool('notebook_create', {
    title: 'Create a note',
    description: 'Create one note and save it in the local SQLite database. It persists across restarts.',
    inputSchema: noteInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: viewUri } },
  }, async input => result(notebook.create(input)));

  server.registerTool('notebook_update', {
    title: 'Update a note',
    description: 'Replace the title, body, and kind of one existing note, preserving its favorite setting.',
    inputSchema: noteInput.extend({ id: z.string().min(1) }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: viewUri } },
  }, async input => result(notebook.update(input)));

  server.registerTool('notebook_favorite', {
    title: 'Set a favorite',
    description: 'Set or clear the favorite flag of one existing note.',
    inputSchema: z.object({ id: z.string().min(1), favorite: z.boolean() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: viewUri } },
  }, async input => result(notebook.favorite(input)));

  return server;
}

// Never print application messages to stdout: stdio is the MCP transport.
serveStdio(createServer);
