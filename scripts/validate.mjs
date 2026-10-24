import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function files(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    assert.ok(!entry.isSymbolicLink(), `Remove the symlink before packaging: ${entry.name}`);
    const full = path.join(root, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

export function validate(root = process.cwd()) {
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const manifest = read('plugin.json'), overlay = read('.codex-plugin/plugin.json');
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(manifest.name, overlay.name);
  assert.equal(manifest.version, overlay.version);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(manifest.extensions['com.openai'].interface, overlay.interface);
  assert.ok(overlay.interface.shortDescription.length <= 30);
  for (const field of ['logo', 'logoDark', 'composerIcon']) {
    assert.ok(overlay.interface[field].startsWith('./assets/'));
    assert.ok(fs.statSync(path.join(root, overlay.interface[field])).isFile());
  }
  const mcp = read('mcp.json');
  assert.equal(mcp.$schema, 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json');
  const servers = Object.values(mcp.mcpServers);
  assert.equal(servers.length, 1);
  assert.deepEqual(servers[0], { type: 'stdio', command: 'node', args: ['${PLUGIN_ROOT}/dist/server/index.mjs'], cwd: '${PLUGIN_ROOT}' });
  const catalog = read('.agents/plugins/marketplace.json');
  assert.equal(catalog.plugins[0].name, manifest.name);
  assert.ok(!catalog.plugins[0].pluginId, 'A template must not bind to a private workspace listing.');
  for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'dist/server/index.mjs', 'dist/ui/index.html', 'skills/open-notebook/SKILL.md']) assert.ok(fs.statSync(path.join(root, file)).size > 0, `Missing ${file}`);
  const html = fs.readFileSync(path.join(root, 'dist/ui/index.html'), 'utf8');
  assert.ok(!/<script[^>]+src=|<link[^>]+rel="stylesheet"/i.test(html), 'Bundle scripts and styles into the UI resource.');
  assert.ok(!/<link[^>]+href="(?!data:)/i.test(html), 'Embed view icons instead of loading assets relative to the host.');
  assert.ok(!html.includes('/src/'), 'The plugin must not depend on the development server.');
  return { plugin: manifest.name, version: manifest.version, status: 'valid' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) console.log(validate(process.argv[2]));
