import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { syncManifest } from './manifest.mjs';

const manifest = syncManifest();
const serverBundle = await build({
  entryPoints: ['src/server/index.ts'],
  outfile: 'dist/server/index.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  legalComments: 'inline',
  metafile: true,
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});

// Attribute the packages actually included in the UI and server bundles.
const inputs = [...Object.keys(serverBundle.metafile.inputs), ...JSON.parse(fs.readFileSync('dist/ui-modules.json', 'utf8'))];
const directories = new Set();
// The foundation stylesheet includes these CSS sources even without JS imports.
for (const cssPackage of ['@openai/apps-sdk-ui', 'tailwindcss', 'katex']) {
  directories.add(path.resolve('node_modules', cssPackage));
}
for (const input of inputs) {
  if (!input.includes('node_modules/')) continue;
  const absolute = path.resolve(input.replace(/^\0/, '').split('?')[0]);
  const marker = `${path.sep}node_modules${path.sep}`;
  const boundary = absolute.lastIndexOf(marker) + marker.length;
  const segments = absolute.slice(boundary).split(path.sep);
  const packageName = segments.slice(0, segments[0].startsWith('@') ? 2 : 1).join(path.sep);
  directories.add(absolute.slice(0, boundary) + packageName);
}
const notices = ['# Third-party software', '', 'These dependencies retain their own licenses. The starter source is MIT licensed.', ''];
const seen = new Set();
for (const directory of [...directories].sort()) {
  const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const licenseFiles = fs.readdirSync(directory).filter(name => /^(?:licen[sc]e|copying|notice)(?:\.|$)/i.test(name) && fs.statSync(path.join(directory, name)).isFile());
  const suppliedLicense = path.join('licenses', `${pkg.name.replaceAll('/', '__')}-${pkg.version}.txt`);
  if (!licenseFiles.length && fs.existsSync(suppliedLicense)) licenseFiles.push(path.resolve(suppliedLicense));
  if (!licenseFiles.length) throw new Error(`No license text found for ${key}. Review it before distributing.`);
  notices.push(`## ${key}`, '', `License: ${typeof pkg.license === 'string' ? pkg.license : 'See the included license text'}`, '');
  for (const file of licenseFiles) notices.push(fs.readFileSync(path.isAbsolute(file) ? file : path.join(directory, file), 'utf8').trim(), '');
}
fs.writeFileSync('THIRD_PARTY_NOTICES.md', notices.join('\n').trimEnd() + '\n');
console.log(`Built ${manifest.name} ${manifest.version}. Included ${seen.size} dependency notices.`);
