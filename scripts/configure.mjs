import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { syncManifest } from './manifest.mjs';

export function configure(root, options) {
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const manifest = read('plugin.json');
  const pkg = read('package.json');
  const mcp = read('mcp.json');
  const marketplace = read('.agents/plugins/marketplace.json');
  const oldName = manifest.name;
  const name = options.name ?? oldName;
  const repository = options.repository ?? pkg.repository.replace('https://github.com/', '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) throw new Error('Use a lowercase plugin name with letters, numbers, and single hyphens.');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Repository must be owner/repository.');
  if (options.version && !/^\d+\.\d+\.\d+$/.test(options.version)) throw new Error('Use a version such as 0.2.0.');
  for (const key of ['display-name', 'author']) if (options[key] !== undefined && !options[key].trim()) throw new Error(`${key} must not be blank.`);
  const url = `https://github.com/${repository}`;
  manifest.name = name;
  manifest.version = options.version ?? manifest.version;
  manifest.homepage = manifest.repository = url;
  if (options.author) manifest.author = { name: options.author };
  const info = manifest.extensions['com.openai'].interface;
  info.displayName = options['display-name'] ?? info.displayName;
  info.developerName = manifest.author.name;
  info.websiteURL = url;
  pkg.name = repository.split('/')[1];
  pkg.version = manifest.version;
  pkg.author = manifest.author.name;
  pkg.repository = url;
  mcp.mcpServers = { [name]: mcp.mcpServers[oldName] };
  marketplace.name = repository.split('/')[1];
  marketplace.interface.displayName = `${info.displayName} plugins`;
  marketplace.plugins[0].name = name;
  for (const [file, data] of Object.entries({ 'plugin.json': manifest, 'package.json': pkg, 'mcp.json': mcp, '.agents/plugins/marketplace.json': marketplace })) {
    fs.writeFileSync(path.join(root, file), JSON.stringify(data, null, 2) + '\n');
  }
  syncManifest(root);
  return { name, version: manifest.version, repository, displayName: info.displayName };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index].replace(/^--/, '');
    if (!['name', 'display-name', 'author', 'repository', 'version'].includes(key) || !args[index + 1]) throw new Error('Use --name NAME --display-name TITLE --author AUTHOR --repository OWNER/REPO --version VERSION.');
    options[key] = args[index + 1];
  }
  console.log(configure(process.cwd(), options));
  console.log('Run npm install --package-lock-only, then update the sample tools, skill, artwork, and README for your own plugin.');
}
