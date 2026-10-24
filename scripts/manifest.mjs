import fs from 'node:fs';
import path from 'node:path';

export function syncManifest(root = process.cwd()) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'));
  const overlay = {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    skills: './skills/',
    mcpServers: './mcp.json',
    ...manifest.extensions['com.openai'],
  };
  fs.mkdirSync(path.join(root, '.codex-plugin'), { recursive: true });
  fs.writeFileSync(path.join(root, '.codex-plugin/plugin.json'), JSON.stringify(overlay, null, 2) + '\n');
  return manifest;
}
