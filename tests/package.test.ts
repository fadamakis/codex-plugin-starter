import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error The validation utility is intentionally plain Node JavaScript.
import { files } from '../scripts/validate.mjs';

test('package enumeration rejects symlinks rather than copying files outside the plugin', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-package-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'own-file.txt'), 'Sample fixture');
  fs.symlinkSync(root, path.join(root, 'outside'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => files(root), /symlink/);
});
