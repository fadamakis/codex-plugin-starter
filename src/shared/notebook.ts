import { z } from 'zod';

export const noteKind = z.enum(['idea', 'draft', 'reference']);
export const noteInput = z.object({
  title: z.string().trim().min(1, 'Give your note a title.').max(80),
  body: z.string().trim().min(1, 'Write a little something first.').max(4000),
  kind: noteKind,
});
export const noteSchema = noteInput.extend({
  id: z.string(), favorite: z.boolean(), updatedAt: z.string().datetime(),
});
export const snapshotSchema = z.object({ notes: z.array(noteSchema) });
export type Note = z.infer<typeof noteSchema>;
export type NoteInput = z.infer<typeof noteInput>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type ToolName = 'notebook_open' | 'notebook_create' | 'notebook_update' | 'notebook_favorite';

// Synthetic examples only. This intentionally small store resets with the server.
export function createNotebook(now = () => new Date()) {
  let notes: Note[] = [
    { id: 'small-idea', title: 'Start with a small idea', body: 'The most useful things often begin as a sentence. Leave room for a rough edge, a question, or a possibility. You can shape it later.', kind: 'idea', favorite: true, updatedAt: now().toISOString() },
    { id: 'fewer-things', title: 'Fewer things, done thoughtfully', body: 'A clear starting point. One useful interaction. Enough space to think. A little restraint can make the whole experience feel better.', kind: 'draft', favorite: false, updatedAt: now().toISOString() },
    { id: 'good-question', title: 'Keep a good question close', body: 'What would make this easier for someone trying it for the first time? That is usually a good place to begin.', kind: 'reference', favorite: false, updatedAt: now().toISOString() },
  ];

  const snapshot = (): Snapshot => ({ notes: notes.map(note => ({ ...note })) });
  function find(id: string) {
    const note = notes.find(note => note.id === id);
    if (!note) throw new Error('That note no longer exists. Reload your notebook and try again.');
    return note;
  }
  return {
    snapshot,
    create(input: unknown) {
      const parsed = noteInput.parse(input);
      if (notes.length >= 100) throw new Error('This sample notebook holds up to 100 notes. Restart the sample to reset it.');
      notes = [{ ...parsed, id: crypto.randomUUID(), favorite: false, updatedAt: now().toISOString() }, ...notes];
      return snapshot();
    },
    update(input: unknown) {
      const { id, ...fields } = noteInput.extend({ id: z.string().min(1) }).parse(input);
      const note = find(id);
      if (note.title !== fields.title || note.body !== fields.body || note.kind !== fields.kind) {
        Object.assign(note, fields, { updatedAt: now().toISOString() });
      }
      return snapshot();
    },
    favorite(input: unknown) {
      const { id, favorite } = z.object({ id: z.string().min(1), favorite: z.boolean() }).parse(input);
      find(id).favorite = favorite;
      return snapshot();
    },
  };
}

export function readSnapshot(result: unknown): Snapshot {
  const envelope = z.object({ isError: z.boolean().optional(), structuredContent: z.unknown().optional() }).parse(result);
  if (envelope.isError) throw new Error('The notebook could not complete that action. Try again.');
  return snapshotSchema.parse(envelope.structuredContent);
}
