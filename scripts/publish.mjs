import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { validate } from './validate.mjs';

if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('Publish from the tagged GitHub Actions workflow. Use npm run package for local builds.');
const { GITHUB_REPOSITORY: repository, GITHUB_REF_NAME: tag, GITHUB_SHA: sourceCommit } = process.env;
if (!repository || !sourceCommit) throw new Error('Missing GitHub release context.');
const plugin = validate('artifacts/plugin');
if (tag !== `v${plugin.version}`) throw new Error('The version tag must match plugin.json.');
const receipt = JSON.parse(fs.readFileSync('artifacts/plugin/release.json', 'utf8'));
if (receipt.sourceCommit !== sourceCommit) throw new Error('The package was built from a different source commit.');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-starter-release-'));
const git = args => execFileSync('git', args, { cwd: temporary, encoding: 'utf8' }).trim();
try {
  const remote = `https://github.com/${repository}.git`;
  const refs = execFileSync('git', ['ls-remote', '--heads', remote, 'releases'], { encoding: 'utf8' });
  if (refs.trim()) {
    execFileSync('git', ['clone', '--depth', '1', '--branch', 'releases', remote, temporary], { stdio: 'inherit' });
    const previousFile = path.join(temporary, 'release.json');
    if (fs.existsSync(previousFile)) {
      const previous = JSON.parse(fs.readFileSync(previousFile, 'utf8'));
      const compare = (left, right) => {
        const a = left.split('.').map(Number), b = right.split('.').map(Number);
        for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
        return 0;
      };
      if (compare(plugin.version, previous.version) < 0 || (plugin.version === previous.version && sourceCommit !== previous.sourceCommit)) {
        throw new Error('This version was already published from another commit, or is older than the current release. Bump the plugin version.');
      }
    }
    for (const file of fs.readdirSync(temporary)) if (file !== '.git') fs.rmSync(path.join(temporary, file), { recursive: true, force: true });
  } else {
    git(['init', '-b', 'releases']);
    git(['remote', 'add', 'origin', remote]);
  }
  fs.cpSync(path.resolve('artifacts/plugin'), temporary, { recursive: true });
  git(['config', 'user.name', 'github-actions[bot]']);
  git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  git(['add', '--all']);
  const changed = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: temporary }).status;
  if (changed === 1) {
    git(['commit', '-m', `Release ${plugin.plugin} ${plugin.version}`]);
    git(['push', 'origin', 'HEAD:refs/heads/releases']);
  } else if (changed !== 0) throw new Error('Could not inspect the release changes.');

  const exists = spawnSync('gh', ['release', 'view', tag, '--repo', repository], { stdio: 'ignore' }).status === 0;
  if (!exists) {
    const notes = path.join(temporary, 'release-notes.txt');
    fs.writeFileSync(notes, `# ${plugin.plugin} ${plugin.version}\n\nBuilt from ${sourceCommit}.\n\nInstall the prebuilt marketplace from the releases branch. See the repository README for setup and updates.\n`);
    execFileSync('gh', ['release', 'create', tag, path.resolve(`artifacts/${plugin.plugin}-${plugin.version}.zip`), path.resolve('artifacts/SHA256SUMS'), '--repo', repository, '--verify-tag', '--title', `${plugin.plugin} ${plugin.version}`, '--notes-file', notes], { stdio: 'inherit' });
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
