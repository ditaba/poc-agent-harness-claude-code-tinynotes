import type { Client } from "@libsql/client";
import type { JSONContent } from "@tiptap/core";
import { rowsOf } from "../open-database";
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

export async function listNotes(
  db: Client,
  userId: string,
): Promise<NoteSummary[]> {
  const result = await db.execute({
    sql: `SELECT id, title, updated_at, share_token IS NOT NULL AS is_shared
          FROM note WHERE user_id = ? ORDER BY updated_at DESC`,
    args: [userId],
  });
  return rowsOf<NoteSummaryRow>(result).map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
    isShared: row.is_shared === 1,
  }));
}

export async function getNote(
  db: Client,
  userId: string,
  id: string,
): Promise<Note | null> {
  const result = await db.execute({
    sql: `SELECT id, title, content, share_token, created_at, updated_at
          FROM note WHERE id = ? AND user_id = ?`,
    args: [id, userId],
  });
  const [row] = rowsOf<NoteRow>(result);
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

export async function createNote(
  db: Client,
  userId: string,
  now = Date.now(),
): Promise<Note> {
  const note: Note = {
    id: crypto.randomUUID(), // D27
    title: "",
    content: structuredClone(EMPTY_DOC),
    shareToken: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.execute({
    sql: `INSERT INTO note (id, user_id, title, content, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [note.id, userId, note.title, JSON.stringify(note.content), now, now],
  });
  return note;
}

// Leaves share_token alone, so saving never changes the share state (NOTE-16).
export async function updateNote(
  db: Client,
  userId: string,
  id: string,
  input: ValidatedNoteInput,
  now = Date.now(),
): Promise<boolean> {
  const { rowsAffected } = await db.execute({
    sql: `UPDATE note SET title = ?, content = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`,
    args: [input.title, input.content, now, id, userId],
  });
  return rowsAffected > 0;
}

export async function deleteNote(
  db: Client,
  userId: string,
  id: string,
): Promise<boolean> {
  const { rowsAffected } = await db.execute({
    sql: "DELETE FROM note WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
  return rowsAffected > 0;
}

// Returns the existing token if the note is already shared (SHARE-6), else stores `token`.
// null when the note is missing or not owned. Share toggles leave updated_at alone (D32).
export async function enableShare(
  db: Client,
  userId: string,
  id: string,
  token: string,
): Promise<string | null> {
  const result = await db.execute({
    sql: `UPDATE note SET share_token = COALESCE(share_token, ?)
          WHERE id = ? AND user_id = ? RETURNING share_token`,
    args: [token, id, userId],
  });
  const [row] = rowsOf<{ share_token: string }>(result);
  return row?.share_token ?? null;
}

// SQLite counts every row the WHERE matches as changed, so an owned note that is already
// private still returns true (D42).
export async function disableShare(
  db: Client,
  userId: string,
  id: string,
): Promise<boolean> {
  const { rowsAffected } = await db.execute({
    sql: "UPDATE note SET share_token = NULL WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
  return rowsAffected > 0;
}

// Public lookup: no user scope, and only what the shared page shows (D8).
export async function getSharedNote(
  db: Client,
  token: string,
): Promise<SharedNote | null> {
  const result = await db.execute({
    sql: "SELECT title, content, updated_at FROM note WHERE share_token = ?",
    args: [token],
  });
  const [row] = rowsOf<SharedNoteRow>(result);
  if (!row) {
    return null;
  }
  return {
    title: row.title,
    content: JSON.parse(row.content) as JSONContent,
    updatedAt: row.updated_at,
  };
}
