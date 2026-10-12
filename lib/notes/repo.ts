import type { Client } from "@libsql/client";
import type { JSONContent } from "@tiptap/core";
import { rowsOf } from "../open-database";
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

export async function listNotes(
  db: Client,
  userId: string,
): Promise<NoteSummary[]> {
  const result = await db.execute({
    sql: `SELECT id, title, updated_at, share_token IS NOT NULL AS is_shared
          FROM note WHERE user_id = ? ORDER BY updated_at DESC`,
    args: [userId],
  });
  return rowsOf<{
    id: string;
    title: string;
    updated_at: number;
    is_shared: number;
  }>(result).map((row) => ({
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
  return row ? toNote(row) : null;
}

export async function createNote(
  db: Client,
  userId: string,
  now = Date.now(),
): Promise<Note> {
  const note: Note = {
    id: crypto.randomUUID(),
    title: "",
    content: structuredClone(EMPTY_DOC),
    shareToken: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.execute({
    sql: `INSERT INTO note (id, user_id, title, content, share_token, created_at, updated_at)
          VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    args: [
      note.id,
      userId,
      note.title,
      JSON.stringify(note.content),
      note.createdAt,
      note.updatedAt,
    ],
  });
  return note;
}

// Leaves share_token untouched (NOTE-16).
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
    sql: `DELETE FROM note WHERE id = ? AND user_id = ?`,
    args: [id, userId],
  });
  return rowsAffected > 0;
}

// Keeps an existing token (SHARE-6) and doesn't touch updated_at (D32).
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
  return row ? row.share_token : null;
}

// True for any owned note, shared or not (D42); doesn't touch updated_at (D32).
export async function disableShare(
  db: Client,
  userId: string,
  id: string,
): Promise<boolean> {
  const { rowsAffected } = await db.execute({
    sql: `UPDATE note SET share_token = NULL WHERE id = ? AND user_id = ?`,
    args: [id, userId],
  });
  return rowsAffected > 0;
}

export async function getSharedNote(
  db: Client,
  token: string,
): Promise<SharedNote | null> {
  const result = await db.execute({
    sql: `SELECT title, content, updated_at FROM note WHERE share_token = ?`,
    args: [token],
  });
  const [row] = rowsOf<{ title: string; content: string; updated_at: number }>(
    result,
  );
  if (!row) return null;
  return {
    title: row.title,
    content: JSON.parse(row.content) as JSONContent,
    updatedAt: row.updated_at,
  };
}
