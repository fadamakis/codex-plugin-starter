import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error The configuration CLI is intentionally plain Node JavaScript.
import { configure } from '../scripts/configure.mjs';

test('a new identity remains consistent across plugin, MCP, marketplace, and compatibility metadata', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-configure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of ['package.json', 'plugin.json', 'mcp.json', '.agents/plugins/marketplace.json']) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(file, path.join(root, file));
  }
  configure(root, { name: 'little-library', 'display-name': 'Little Library', author: 'Example Author', repository: 'example/little-library', version: '0.2.0' });
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  assert.equal(read('plugin.json').name, 'little-library');
  assert.equal(read('.codex-plugin/plugin.json').interface.displayName, 'Little Library');
  assert.equal(read('package.json').version, '0.2.0');
  assert.deepEqual(Object.keys(read('mcp.json').mcpServers), ['little-library']);
  assert.equal(read('.agents/plugins/marketplace.json').name, 'little-library');
  assert.equal(read('.agents/plugins/marketplace.json').plugins[0].name, 'little-library');
  assert.throws(() => configure(root, { name: '../elsewhere' }));
  assert.equal(read('plugin.json').name, 'little-library');
});
