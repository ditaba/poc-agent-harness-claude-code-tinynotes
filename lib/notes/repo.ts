import type { Database } from "bun:sqlite";
import type { JSONContent } from "@tiptap/core";
import { EMPTY_DOC } from "./editor-extensions";
import type { ValidatedNoteInput } from "./validation";

// All note SQL. Every query uses ? parameters, and every owner query has
// `AND user_id = ?`: another user's note behaves exactly like a missing one (D24).

export type Note = {
  id: string;
  title: string;
  content: JSONContent;
  shareToken: string | null;
  createdAt: number;
  updatedAt: number;
};
export type NoteSummary = {
  id: string;
  title: string;
  updatedAt: number;
  isShared: boolean;
};
export type SharedNote = {
  title: string;
  content: JSONContent;
  updatedAt: number;
};

type NoteRow = {
  id: string;
  title: string;
  content: string;
  share_token: string | null;
  created_at: number;
  updated_at: number;
};

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: JSON.parse(row.content) as JSONContent,
    shareToken: row.share_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listNotes(db: Database, userId: string): NoteSummary[] {
  const rows = db
    .query<
      { id: string; title: string; updated_at: number; is_shared: number },
      [string]
    >(
      `SELECT id, title, updated_at, share_token IS NOT NULL AS is_shared
       FROM note WHERE user_id = ? ORDER BY updated_at DESC`,
    )
    .all(userId);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    isShared: row.is_shared === 1,
  }));
}

export function getNote(db: Database, userId: string, id: string): Note | null {
  const row = db
    .query<NoteRow, [string, string]>(
      `SELECT id, title, content, share_token, created_at, updated_at
       FROM note WHERE id = ? AND user_id = ?`,
    )
    .get(id, userId);
  return row ? toNote(row) : null;
}

export function createNote(
  db: Database,
  userId: string,
  now = Date.now(),
): Note {
  const note: Note = {
    id: crypto.randomUUID(),
    title: "",
    content: structuredClone(EMPTY_DOC),
    shareToken: null,
    createdAt: now,
    updatedAt: now,
  };
  db.query(
    `INSERT INTO note (id, user_id, title, content, share_token, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`,
  ).run(
    note.id,
    userId,
    note.title,
    JSON.stringify(note.content),
    note.createdAt,
    note.updatedAt,
  );
  return note;
}

// Leaves share_token untouched (NOTE-16).
export function updateNote(
  db: Database,
  userId: string,
  id: string,
  input: ValidatedNoteInput,
  now = Date.now(),
): boolean {
  const { changes } = db
    .query(
      `UPDATE note SET title = ?, content = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
    .run(input.title, input.content, now, id, userId);
  return changes > 0;
}

export function deleteNote(db: Database, userId: string, id: string): boolean {
  const { changes } = db
    .query(`DELETE FROM note WHERE id = ? AND user_id = ?`)
    .run(id, userId);
  return changes > 0;
}

// Keeps an existing token (SHARE-6) and doesn't touch updated_at (D32).
export function enableShare(
  db: Database,
  userId: string,
  id: string,
  token: string,
): string | null {
  const row = db
    .query<{ share_token: string }, [string, string, string]>(
      `UPDATE note SET share_token = COALESCE(share_token, ?)
       WHERE id = ? AND user_id = ? RETURNING share_token`,
    )
    .get(token, id, userId);
  return row ? row.share_token : null;
}

// True for any owned note, shared or not (D42); doesn't touch updated_at (D32).
export function disableShare(
  db: Database,
  userId: string,
  id: string,
): boolean {
  const { changes } = db
    .query(`UPDATE note SET share_token = NULL WHERE id = ? AND user_id = ?`)
    .run(id, userId);
  return changes > 0;
}

export function getSharedNote(db: Database, token: string): SharedNote | null {
  const row = db
    .query<{ title: string; content: string; updated_at: number }, [string]>(
      `SELECT title, content, updated_at FROM note WHERE share_token = ?`,
    )
    .get(token);
  if (!row) return null;
  return {
    title: row.title,
    content: JSON.parse(row.content) as JSONContent,
    updatedAt: row.updated_at,
  };
}
