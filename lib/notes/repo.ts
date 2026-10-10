import type { Database } from "bun:sqlite";
import type { JSONContent } from "@tiptap/core";
import { EMPTY_DOC } from "./editor-extensions";
import type { ValidatedNoteInput } from "./validation";

// All note SQL lives here. Every statement uses ? parameters, and every owner query is scoped with
// `AND user_id = ?`, so a note the user doesn't own behaves exactly like a missing one (D24).
// Functions take db first so tests can pass an in-memory DB.

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

type NoteSummaryRow = {
  id: string;
  title: string;
  updated_at: number;
  is_shared: number;
};

type SharedNoteRow = { title: string; content: string; updated_at: number };

export function listNotes(db: Database, userId: string): NoteSummary[] {
  return db
    .query<NoteSummaryRow, [string]>(
      `SELECT id, title, updated_at, share_token IS NOT NULL AS is_shared
       FROM note WHERE user_id = ? ORDER BY updated_at DESC`,
    )
    .all(userId)
    .map((row) => ({
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
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    title: row.title,
    content: JSON.parse(row.content) as JSONContent,
    shareToken: row.share_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createNote(
  db: Database,
  userId: string,
  now = Date.now(),
): Note {
  const note: Note = {
    id: crypto.randomUUID(), // D27
    title: "",
    content: structuredClone(EMPTY_DOC),
    shareToken: null,
    createdAt: now,
    updatedAt: now,
  };
  db.query(
    `INSERT INTO note (id, user_id, title, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(note.id, userId, note.title, JSON.stringify(note.content), now, now);
  return note;
}

// Leaves share_token alone, so saving never changes the share state (NOTE-16).
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
    .query("DELETE FROM note WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return changes > 0;
}

// Returns the existing token if the note is already shared (SHARE-6), else stores `token`.
// null when the note is missing or not owned. Share toggles leave updated_at alone (D32).
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
  return row?.share_token ?? null;
}

// SQLite counts every row the WHERE matches as changed, so an owned note that is already
// private still returns true (D42).
export function disableShare(
  db: Database,
  userId: string,
  id: string,
): boolean {
  const { changes } = db
    .query("UPDATE note SET share_token = NULL WHERE id = ? AND user_id = ?")
    .run(id, userId);
  return changes > 0;
}

// Public lookup: no user scope, and only what the shared page shows (D8).
export function getSharedNote(db: Database, token: string): SharedNote | null {
  const row = db
    .query<SharedNoteRow, [string]>(
      "SELECT title, content, updated_at FROM note WHERE share_token = ?",
    )
    .get(token);
  if (!row) {
    return null;
  }
  return {
    title: row.title,
    content: JSON.parse(row.content) as JSONContent,
    updatedAt: row.updated_at,
  };
}
