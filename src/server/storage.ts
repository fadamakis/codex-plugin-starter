import { closeSync, mkdirSync, openSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { noteSchema, sampleNotes, type Note, type NoteStore } from '../shared/notebook';

export function notebookDataDirectory(name: string, env: NodeJS.ProcessEnv = process.env, platform = process.platform, home = os.homedir()) {
  if (env.NOTEBOOK_DATA_DIR) {
    if (!path.isAbsolute(env.NOTEBOOK_DATA_DIR)) throw new Error('NOTEBOOK_DATA_DIR must be an absolute path.');
    return env.NOTEBOOK_DATA_DIR;
  }
  const base = platform === 'darwin' ? path.join(home, 'Library', 'Application Support')
    : platform === 'win32' ? env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
    : env.XDG_DATA_HOME && path.isAbsolute(env.XDG_DATA_HOME) ? env.XDG_DATA_HOME : path.join(home, '.local', 'share');
  return path.join(base, name);
}

export function createSqliteNoteStore(filename: string): NoteStore & { close(): void } {
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  closeSync(openSync(filename, 'a', 0o600));
  const db = new DatabaseSync(filename);
  try {
    db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
    db.exec('BEGIN IMMEDIATE');
    try {
      const version = db.prepare('PRAGMA user_version').get()?.user_version;
      if (version === 0) {
        db.exec(`CREATE TABLE notes (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('idea', 'draft', 'reference')),
          favorite INTEGER NOT NULL CHECK (favorite IN (0, 1)),
          updatedAt TEXT NOT NULL
        ) STRICT`);
        const seed = db.prepare('INSERT INTO notes (id, title, body, kind, favorite, updatedAt) VALUES (?, ?, ?, ?, ?, ?)');
        for (const note of sampleNotes().reverse()) seed.run(note.id, note.title, note.body, note.kind, Number(note.favorite), note.updatedAt);
        db.exec('PRAGMA user_version = 1');
      } else if (version !== 1) {
        throw new Error('This notebook database needs a newer plugin version.');
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const columns = 'id, title, body, kind, favorite, updatedAt';
    const all = db.prepare(`SELECT ${columns} FROM notes ORDER BY sequence DESC`);
    const get = db.prepare(`SELECT ${columns} FROM notes WHERE id = ?`);
    const insert = db.prepare('INSERT INTO notes (id, title, body, kind, favorite, updatedAt) VALUES (?, ?, ?, ?, ?, ?)');
    const update = db.prepare('UPDATE notes SET title = ?, body = ?, kind = ?, updatedAt = ? WHERE id = ?');
    const favorite = db.prepare('UPDATE notes SET favorite = ? WHERE id = ?');
    const read = (row: Record<string, unknown>): Note => noteSchema.parse({ ...row, favorite: row.favorite === 1 });
    return {
      list() { return all.all().map(read); },
      get(id) { const row = get.get(id); return row ? read(row) : undefined; },
      insert(note) { insert.run(note.id, note.title, note.body, note.kind, Number(note.favorite), note.updatedAt); },
      updateContent(id, input, updatedAt) { update.run(input.title, input.body, input.kind, updatedAt, id); },
      setFavorite(id, value) { favorite.run(Number(value), id); },
      close() { db.close(); },
    };
  } catch (error) {
    db.close();
    throw error;
  }
}
