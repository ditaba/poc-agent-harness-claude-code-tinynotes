import type { Client } from "@libsql/client";
import { beforeEach, describe, expect, test } from "bun:test";
import { rowsOf } from "../open-database";
import { generateShareToken } from "../share-token";
import { createTestDb, insertTestUser } from "../testing/db";
import { EMPTY_DOC } from "./editor-extensions";
import {
  createNote,
  deleteNote,
  disableShare,
  enableShare,
  getNote,
  getSharedNote,
  listNotes,
  updateNote,
} from "./repo";

const savedInput = {
  title: "Saved",
  content: JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
  }),
};

let db: Client;
let alice: string;
let bob: string;

async function rawRow(id: string) {
  const result = await db.execute({
    sql: `SELECT * FROM note WHERE id = ?`,
    args: [id],
  });
  return rowsOf(result)[0] ?? null;
}

beforeEach(async () => {
  db = await createTestDb();
  alice = await insertTestUser(db);
  bob = await insertTestUser(db);
});

describe("createNote / getNote / listNotes", () => {
  test("createNote defaults: empty title, EMPTY_DOC, uuid id, timestamps = now (D27)", async () => {
    const note = await createNote(db, alice, 1_000);
    expect(note).toEqual({
      id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
      title: "",
      content: EMPTY_DOC,
      shareToken: null,
      createdAt: 1_000,
      updatedAt: 1_000,
    });
    expect(await getNote(db, alice, note.id)).toEqual(note);
  });

  test("listNotes is ordered by updated_at desc and scoped to the user", async () => {
    const first = await createNote(db, alice, 1_000);
    const second = await createNote(db, alice, 2_000);
    const third = await createNote(db, alice, 3_000);
    await createNote(db, bob, 4_000);
    await updateNote(db, alice, first.id, savedInput, 5_000);
    await enableShare(db, alice, second.id, generateShareToken());

    expect(await listNotes(db, alice)).toEqual([
      { id: first.id, title: "Saved", updatedAt: 5_000, isShared: false },
      { id: third.id, title: "", updatedAt: 3_000, isShared: false },
      { id: second.id, title: "", updatedAt: 2_000, isShared: true },
    ]);
    expect(await listNotes(db, bob)).toHaveLength(1);
  });

  test("getNote for another user → null (D24)", async () => {
    const note = await createNote(db, alice);
    expect(await getNote(db, bob, note.id)).toBeNull();
    expect(await getNote(db, alice, crypto.randomUUID())).toBeNull();
  });
});

describe("updateNote / deleteNote", () => {
  test("updateNote for another user → false and the row is unchanged (D24)", async () => {
    const note = await createNote(db, alice, 1_000);
    const before = await rawRow(note.id);
    expect(await updateNote(db, bob, note.id, savedInput, 2_000)).toBe(false);
    expect(await rawRow(note.id)).toEqual(before);
  });

  test("updateNote sets title, content, updated_at and keeps share_token (NOTE-16)", async () => {
    const note = await createNote(db, alice, 1_000);
    const token = await enableShare(db, alice, note.id, generateShareToken());
    expect(await updateNote(db, alice, note.id, savedInput, 2_000)).toBe(true);
    expect(await getNote(db, alice, note.id)).toEqual({
      id: note.id,
      title: "Saved",
      content: JSON.parse(savedInput.content),
      shareToken: token,
      createdAt: 1_000,
      updatedAt: 2_000,
    });
  });

  test("deleteNote for another user → false and the row stays (D24)", async () => {
    const note = await createNote(db, alice);
    expect(await deleteNote(db, bob, note.id)).toBe(false);
    expect(await getNote(db, alice, note.id)).not.toBeNull();
    expect(await deleteNote(db, alice, note.id)).toBe(true);
    expect(await getNote(db, alice, note.id)).toBeNull();
  });
});

describe("sharing", () => {
  test("enableShare twice → the same token (SHARE-6)", async () => {
    const note = await createNote(db, alice);
    const token = generateShareToken();
    expect(await enableShare(db, alice, note.id, token)).toBe(token);
    expect(await enableShare(db, alice, note.id, generateShareToken())).toBe(
      token,
    );
  });

  test("enableShare on another user's note → null and no token is stored", async () => {
    const note = await createNote(db, alice);
    expect(
      await enableShare(db, bob, note.id, generateShareToken()),
    ).toBeNull();
    expect((await getNote(db, alice, note.id))?.shareToken).toBeNull();
  });

  test("getSharedNote returns title, content and updatedAt for an active token", async () => {
    const note = await createNote(db, alice, 1_000);
    await updateNote(db, alice, note.id, savedInput, 2_000);
    const token = (await enableShare(
      db,
      alice,
      note.id,
      generateShareToken(),
    ))!;
    expect(await getSharedNote(db, token)).toEqual({
      title: "Saved",
      content: JSON.parse(savedInput.content),
      updatedAt: 2_000,
    });
  });

  test("disableShare → getSharedNote(oldToken) is null; re-enabling returns the new token", async () => {
    const note = await createNote(db, alice);
    const oldToken = (await enableShare(
      db,
      alice,
      note.id,
      generateShareToken(),
    ))!;
    expect(await disableShare(db, alice, note.id)).toBe(true);
    expect(await getSharedNote(db, oldToken)).toBeNull();

    const newToken = generateShareToken();
    expect(await enableShare(db, alice, note.id, newToken)).toBe(newToken);
    expect(await getSharedNote(db, newToken)).not.toBeNull();
    expect(await getSharedNote(db, oldToken)).toBeNull();
  });

  test("disableShare on an owned private note → true; on another user's note → false (D42)", async () => {
    const note = await createNote(db, alice);
    expect(await disableShare(db, alice, note.id)).toBe(true);

    const token = (await enableShare(
      db,
      alice,
      note.id,
      generateShareToken(),
    ))!;
    expect(await disableShare(db, bob, note.id)).toBe(false);
    expect(await getSharedNote(db, token)).not.toBeNull();
  });

  test("share toggles don't change updated_at (D32)", async () => {
    const note = await createNote(db, alice, 1_000);
    await enableShare(db, alice, note.id, generateShareToken());
    expect((await getNote(db, alice, note.id))?.updatedAt).toBe(1_000);
    await disableShare(db, alice, note.id);
    expect((await getNote(db, alice, note.id))?.updatedAt).toBe(1_000);
  });

  test("getSharedNote after deleteNote → null", async () => {
    const note = await createNote(db, alice);
    const token = (await enableShare(
      db,
      alice,
      note.id,
      generateShareToken(),
    ))!;
    await deleteNote(db, alice, note.id);
    expect(await getSharedNote(db, token)).toBeNull();
  });
});

describe("schema constraints", () => {
  async function insertWithContent(content: string) {
    await db.execute({
      sql: `INSERT INTO note (id, user_id, title, content, created_at, updated_at)
            VALUES (?, ?, '', ?, 0, 0)`,
      args: [crypto.randomUUID(), alice, content],
    });
  }

  test("direct INSERT with content over 102 400 bytes fails the CHECK (D40)", async () => {
    // JSON string literal: 2 quote bytes + text.
    await insertWithContent(`"${"a".repeat(102_398)}"`);
    await expect(insertWithContent(`"${"a".repeat(102_399)}"`)).rejects.toThrow(
      /CHECK constraint failed/,
    );
    expect(await listNotes(db, alice)).toHaveLength(1);
  });

  test("deleting a user row cascades to their notes", async () => {
    await createNote(db, alice);
    await createNote(db, alice);
    await createNote(db, bob);
    await db.execute({ sql: `DELETE FROM "user" WHERE id = ?`, args: [alice] });
    const result = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM note WHERE user_id = ?`,
      args: [alice],
    });
    expect(rowsOf(result)).toEqual([{ n: 0 }]);
    expect(await listNotes(db, bob)).toHaveLength(1);
  });
});
