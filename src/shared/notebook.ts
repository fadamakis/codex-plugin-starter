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

export interface NoteStore {
  list(): Note[];
  get(id: string): Note | undefined;
  insert(note: Note): void;
  updateContent(id: string, input: NoteInput, updatedAt: string): void;
  setFavorite(id: string, favorite: boolean): void;
}

export function sampleNotes(now = () => new Date()): Note[] {
  return [
    { id: 'small-idea', title: 'Start with a small idea', body: 'The most useful things often begin as a sentence. Leave room for a rough edge, a question, or a possibility. You can shape it later.', kind: 'idea', favorite: true, updatedAt: now().toISOString() },
    { id: 'fewer-things', title: 'Fewer things, done thoughtfully', body: 'A clear starting point. One useful interaction. Enough space to think. A little restraint can make the whole experience feel better.', kind: 'draft', favorite: false, updatedAt: now().toISOString() },
    { id: 'good-question', title: 'Keep a good question close', body: 'What would make this easier for someone trying it for the first time? That is usually a good place to begin.', kind: 'reference', favorite: false, updatedAt: now().toISOString() },
  ];
}

export function createMemoryNoteStore(initial: Note[], persist?: (notes: Note[]) => void): NoteStore {
  let notes = initial.map(note => ({ ...note }));
  const list = () => notes.map(note => ({ ...note }));
  function save(next: Note[]) {
    persist?.(next.map(note => ({ ...note })));
    notes = next;
  }
  return {
    list,
    get(id) { return list().find(note => note.id === id); },
    insert(note) { save([{ ...note }, ...notes]); },
    updateContent(id, input, updatedAt) {
      save(notes.map(note => note.id === id ? { ...note, ...input, updatedAt } : note));
    },
    setFavorite(id, favorite) {
      save(notes.map(note => note.id === id ? { ...note, favorite } : note));
    },
  };
}

export function createNotebook(now = () => new Date(), storage?: NoteStore) {
  const store = storage ?? createMemoryNoteStore(sampleNotes(now));
  const snapshot = (): Snapshot => ({ notes: store.list() });
  function find(id: string) {
    const note = store.get(id);
    if (!note) throw new Error('That note no longer exists. Reload your notebook and try again.');
    return note;
  }
  return {
    snapshot,
    create(input: unknown) {
      const parsed = noteInput.parse(input);
      store.insert({ ...parsed, id: crypto.randomUUID(), favorite: false, updatedAt: now().toISOString() });
      return snapshot();
    },
    update(input: unknown) {
      const { id, ...fields } = noteInput.extend({ id: z.string().min(1) }).parse(input);
      const note = find(id);
      if (note.title !== fields.title || note.body !== fields.body || note.kind !== fields.kind) {
        store.updateContent(id, fields, now().toISOString());
      }
      return snapshot();
    },
    favorite(input: unknown) {
      const { id, favorite } = z.object({ id: z.string().min(1), favorite: z.boolean() }).parse(input);
      find(id);
      store.setFavorite(id, favorite);
      return snapshot();
    },
  };
}

export function readSnapshot(result: unknown): Snapshot {
  const envelope = z.object({ isError: z.boolean().optional(), structuredContent: z.unknown().optional() }).parse(result);
  if (envelope.isError) throw new Error('The notebook could not complete that action. Try again.');
  return snapshotSchema.parse(envelope.structuredContent);
}
