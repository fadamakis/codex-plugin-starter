import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createMemoryNoteStore, createNotebook, sampleNotes } from '../src/shared/notebook';
import { createSqliteNoteStore, notebookDataDirectory } from '../src/server/storage';

function database(t: { after(fn: () => void): void }, close = () => {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'notebook-storage-'));
  t.after(() => { close(); fs.rmSync(directory, { recursive: true, force: true }); });
  return path.join(directory, 'data', 'notebook.sqlite3');
}

test('SQLite keeps created notes, edits, favorites, and sample IDs across restarts', t => {
  let store: ReturnType<typeof createSqliteNoteStore>;
  const filename = database(t, () => store?.close());
  store = createSqliteNoteStore(filename);
  const notebook = createNotebook(undefined, store);
  const initial = notebook.snapshot();
  const note = notebook.create({ title: "A 'quoted' title", body: "'); DROP TABLE notes; --", kind: 'idea' }).notes[0];
  notebook.favorite({ id: note.id, favorite: true });
  const saved = notebook.update({ id: note.id, title: 'Updated plan', body: note.body, kind: 'draft' });
  assert.throws(() => notebook.create({ title: '', body: 'Invalid', kind: 'idea' }));
  assert.throws(() => notebook.update({ id: 'missing', title: 'Missing', body: 'Invalid', kind: 'idea' }));
  store.close();
  store = createSqliteNoteStore(filename);
  const reopened = createNotebook(undefined, store);
  assert.deepEqual(reopened.snapshot(), saved);
  assert.deepEqual(reopened.snapshot().notes.slice(1), initial.notes);
  assert.equal(reopened.snapshot().notes[0].favorite, true);
  if (process.platform !== 'win32') assert.equal(fs.statSync(filename).mode & 0o077, 0);
});

test('independent SQLite connections see each other’s changes without replacing unrelated fields', t => {
  let first: ReturnType<typeof createSqliteNoteStore>, second: ReturnType<typeof createSqliteNoteStore>;
  const filename = database(t, () => { first?.close(); second?.close(); });
  first = createSqliteNoteStore(filename);
  second = createSqliteNoteStore(filename);
  const a = createNotebook(undefined, first), b = createNotebook(undefined, second);
  const note = a.create({ title: 'From the panel', body: 'Keep this.', kind: 'idea' }).notes[0];
  b.create({ title: 'From the conversation', body: 'Keep this too.', kind: 'draft' });
  b.favorite({ id: note.id, favorite: true });
  a.update({ id: note.id, title: 'Edited in the panel', body: note.body, kind: note.kind });
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.equal(a.snapshot().notes.length, 5);
  assert.equal(a.snapshot().notes.find(value => value.id === note.id)?.favorite, true);
});

test('a newer database schema fails without erasing existing data', t => {
  const filename = database(t);
  const store = createSqliteNoteStore(filename);
  store.close();
  const raw = new DatabaseSync(filename);
  raw.exec('PRAGMA user_version = 99');
  raw.close();
  assert.throws(() => createSqliteNoteStore(filename), /newer plugin version/);
  const reopened = new DatabaseSync(filename);
  assert.equal(reopened.prepare('SELECT COUNT(*) AS total FROM notes').get()?.total, 3);
  assert.equal(reopened.prepare('PRAGMA user_version').get()?.user_version, 99);
  reopened.close();
});

test('storage paths stay outside versioned plugin directories and can be overridden', () => {
  const home = path.resolve('fake-home');
  assert.equal(notebookDataDirectory('notebook', {}, 'darwin', home), path.join(home, 'Library', 'Application Support', 'notebook'));
  assert.equal(notebookDataDirectory('other-plugin', {}, 'linux', home), path.join(home, '.local', 'share', 'other-plugin'));
  const custom = path.join(home, 'custom');
  assert.equal(notebookDataDirectory('notebook', { XDG_DATA_HOME: custom }, 'linux', home), path.join(custom, 'notebook'));
  assert.equal(notebookDataDirectory('notebook', { LOCALAPPDATA: custom }, 'win32', home), path.join(custom, 'notebook'));
  assert.equal(notebookDataDirectory('notebook', { NOTEBOOK_DATA_DIR: custom }, 'darwin', home), custom);
  assert.throws(() => notebookDataDirectory('notebook', { NOTEBOOK_DATA_DIR: './relative' }), /absolute path/);
});

test('a failed preview storage write leaves the last saved state intact', () => {
  const initial = sampleNotes();
  const store = createMemoryNoteStore(initial, () => { throw new Error('Storage is full'); });
  const notebook = createNotebook(undefined, store);
  assert.throws(() => notebook.create({ title: 'Unsaved', body: 'No space.', kind: 'idea' }), /Storage is full/);
  assert.deepEqual(notebook.snapshot().notes, initial);
});
