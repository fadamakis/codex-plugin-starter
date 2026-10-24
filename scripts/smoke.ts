import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readSnapshot } from '../src/shared/notebook';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const client = new Client({ name: 'starter-smoke-test', version: '1.0.0' });
const temporary = process.argv[2] ? fs.mkdtempSync(path.join(os.tmpdir(), 'starter-clean-install-')) : null;
const root = temporary ?? process.cwd();
try {
  if (temporary) fs.cpSync(path.resolve(process.argv[2]), root, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'));
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'dist/server/index.mjs')], cwd: root, stderr: 'pipe',
    env: { PATH: process.env.PATH ?? '', HOME: root, TMPDIR: root, TMP: root, TEMP: root, SystemRoot: process.env.SystemRoot ?? '' } }));
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
  console.log(`MCP smoke passed: ${tools.tools.length} tools, structured results, mutations, and a self-contained UI.`);
} finally {
  await client.close();
  if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
}
