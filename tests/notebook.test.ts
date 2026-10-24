import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotebook, readSnapshot } from '../src/shared/notebook';

test('create, edit, and favorite notes without exposing mutable internal records', () => {
  const notebook = createNotebook(() => new Date('2026-01-01T12:00:00Z'));
  const original = notebook.snapshot();
  original.notes[0].title = 'Changed outside the store';
  assert.equal(notebook.snapshot().notes[0].title, 'Start with a small idea');
  const created = notebook.create({ title: '  A new idea  ', body: '  Keep this.  ', kind: 'idea' });
  const note = created.notes[0];
  assert.equal(note.title, 'A new idea');
  notebook.favorite({ id: note.id, favorite: true });
  const edited = notebook.update({ id: note.id, title: 'A clearer idea', body: 'Keep this too.', kind: 'draft' });
  assert.equal(edited.notes[0].favorite, true);
  assert.equal(edited.notes[0].kind, 'draft');
  assert.equal(edited.notes.length, 4);
});

test('invalid or stale edits leave the notebook intact', () => {
  const notebook = createNotebook();
  const before = notebook.snapshot();
  assert.throws(() => notebook.create({ title: ' ', body: 'A body', kind: 'idea' }));
  assert.throws(() => notebook.update({ id: 'unknown', title: 'A title', body: 'A body', kind: 'idea' }));
  assert.throws(() => notebook.favorite({ id: 'small-idea', favorite: 'true' }));
  assert.deepEqual(notebook.snapshot(), before);
});

test('untrusted tool results must match the shared schema', () => {
  assert.throws(() => readSnapshot({ isError: true, structuredContent: { notes: [] } }));
  assert.throws(() => readSnapshot({ structuredContent: { notes: [{ title: 'Invalid' }] } }));
  const notebook = createNotebook();
  assert.deepEqual(readSnapshot({ structuredContent: notebook.snapshot() }), notebook.snapshot());
});
