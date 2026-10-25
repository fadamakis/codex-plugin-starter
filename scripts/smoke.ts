import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readSnapshot } from '../src/shared/notebook';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-clean-install-'));
const root = process.argv[2] ? path.join(temporary, 'plugin') : process.cwd();
const clients: Client[] = [];
async function connect() {
  const client = new Client({ name: 'starter-smoke-test', version: '1.0.0' });
  clients.push(client);
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'dist/server/index.mjs')], cwd: root, stderr: 'pipe',
    env: { PATH: process.env.PATH ?? '', HOME: temporary, NOTEBOOK_DATA_DIR: path.join(temporary, 'data'), TMPDIR: temporary, TMP: temporary, TEMP: temporary, SystemRoot: process.env.SystemRoot ?? '' } }));
  return client;
}
try {
  if (process.argv[2]) fs.cpSync(path.resolve(process.argv[2]), root, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'));
  const client = await connect();
  assert.equal(client.getServerVersion()?.version, manifest.version);
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map(tool => tool.name).sort(), ['notebook_create', 'notebook_favorite', 'notebook_open', 'notebook_update']);
  const open = tools.tools.find(tool => tool.name === 'notebook_open')!;
  assert.equal(open.annotations?.readOnlyHint, true);
  assert.deepEqual((open._meta?.['openai/ui'] as { entrypoints: unknown[] }).entrypoints, [{ type: 'global' }]);
  assert.equal(tools.tools.find(tool => tool.name === 'notebook_create')?.annotations?.readOnlyHint, false);
  const initial = readSnapshot(await client.callTool({ name: 'notebook_open', arguments: {} }));
  assert.equal(initial.notes.length, 3);
  const created = readSnapshot(await client.callTool({ name: 'notebook_create', arguments: { title: 'Smoke test', body: 'Synthetic sample only.', kind: 'idea' } }));
  const note = created.notes.find(note => note.title === 'Smoke test')!;
  assert.ok(note);
  const favorite = readSnapshot(await client.callTool({ name: 'notebook_favorite', arguments: { id: note.id, favorite: true } }));
  assert.equal(favorite.notes.find(value => value.id === note.id)?.favorite, true);
  const updated = readSnapshot(await client.callTool({ name: 'notebook_update', arguments: { id: note.id, title: 'Updated sample', body: 'Changed through MCP.', kind: 'reference' } }));
  assert.equal(updated.notes.find(value => value.id === note.id)?.title, 'Updated sample');
  const resources = await client.listResources();
  assert.equal((open._meta?.ui as { resourceUri: string }).resourceUri, resources.resources[0].uri);
  const ui = await client.readResource({ uri: resources.resources[0].uri });
  assert.ok(ui.contents.some(content => 'text' in content && content.text.includes('<!doctype html>')));
  const second = await connect();
  await Promise.all([client, second].map((connection, index) => connection.callTool({ name: 'notebook_create', arguments: { title: `Process ${index}`, body: 'Concurrent write.', kind: 'draft' } })));
  const shared = readSnapshot(await second.callTool({ name: 'notebook_open', arguments: {} }));
  assert.equal(shared.notes.length, 6);
  assert.ok(shared.notes.some(note => note.title === 'Process 0'));
  assert.ok(shared.notes.some(note => note.title === 'Process 1'));
  await client.close();
  await second.close();
  const restarted = await connect();
  assert.deepEqual(readSnapshot(await restarted.callTool({ name: 'notebook_open', arguments: {} })), shared);
  console.log(`MCP smoke passed: ${tools.tools.length} tools, persistent notes across processes and restarts, and a self-contained UI.`);
} finally {
  await Promise.all(clients.map(client => client.close()));
  fs.rmSync(temporary, { recursive: true, force: true });
}
