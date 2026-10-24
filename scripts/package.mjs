import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';
import { validate, files } from './validate.mjs';

const manifest = validate();
const target = path.resolve('artifacts/plugin');
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
for (const file of ['plugin.json', '.codex-plugin', 'mcp.json', '.agents/plugins', 'dist/server', 'dist/ui', 'skills', 'assets', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md', 'docs']) {
  fs.cpSync(file, path.join(target, file), { recursive: true });
}
fs.writeFileSync(path.join(target, 'release.json'), JSON.stringify({
  plugin: manifest.plugin, version: manifest.version, sourceCommit: process.env.GITHUB_SHA || 'local',
}, null, 2) + '\n');
validate(target);
const entries = {};
for (const file of files(target)) {
  const name = path.relative(target, file).split(path.sep).join('/');
  assertSafe(name);
  entries[name] = [new Uint8Array(fs.readFileSync(file)), { mtime: new Date('2026-01-01T00:00:00Z') }];
}
const archive = path.resolve(`artifacts/${manifest.plugin}-${manifest.version}.zip`);
fs.writeFileSync(archive, zipSync(entries, { level: 6 }));
const digest = createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
fs.writeFileSync('artifacts/SHA256SUMS', `${digest}  ${path.basename(archive)}\n`);
console.log(`Packaged ${Object.keys(entries).length} files into ${path.relative(process.cwd(), archive)}.`);

function assertSafe(name) {
  if (/(^|\/)(node_modules|\.git|\.env|test-results)(\/|$)|\.sqlite(?:$|-)/.test(name)) throw new Error(`Unexpected package file: ${name}`);
}
