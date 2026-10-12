import type { Client } from "@libsql/client";
import { beforeEach, describe, expect, test } from "bun:test";
import { rowsOf } from "../open-database";
import { generateShareToken } from "../share-token";
import { createTestDb, insertTestUser } from "../testing/db";
import { EMPTY_DOC } from "./editor-extensions";
import { CONTENT_MAX_BYTES, utf8ByteLength } from "./limits";
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const groceries = {
  title: "Groceries",
  content: JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Milk" }] }],
  }),
};

type RawNoteRow = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  share_token: string | null;
  created_at: number;
  updated_at: number;
};

async function rawRow(db: Client, id: string): Promise<RawNoteRow | null> {
  const result = await db.execute({
    sql: "SELECT * FROM note WHERE id = ?",
    args: [id],
  });
  return rowsOf<RawNoteRow>(result)[0] ?? null;
}

async function insertRaw(
  db: Client,
  userId: string,
  content: string,
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO note (id, user_id, content, created_at, updated_at)
          VALUES (?, ?, ?, 0, 0)`,
    args: [crypto.randomUUID(), userId, content],
  });
}

let db: Client;
let alice: string;
let bob: string;

beforeEach(async () => {
  db = await createTestDb();
  alice = await insertTestUser(db);
  bob = await insertTestUser(db);
});

describe("createNote", () => {
  test('defaults: title "", EMPTY_DOC, a UUID id, created_at = updated_at = now (D27)', async () => {
    const note = await createNote(db, alice, 1_000);

    expect(note).toEqual({
      id: expect.stringMatching(UUID_PATTERN),
      title: "",
      content: EMPTY_DOC,
      shareToken: null,
      createdAt: 1_000,
      updatedAt: 1_000,
    });
    expect(await getNote(db, alice, note.id)).toEqual(note);
    expect(await rawRow(db, note.id)).toEqual({
      id: note.id,
      user_id: alice,
      title: "",
      content: JSON.stringify(EMPTY_DOC),
      share_token: null,
      created_at: 1_000,
      updated_at: 1_000,
    });
  });

  test("now defaults to the current time", async () => {
    const before = Date.now();
    const note = await createNote(db, alice);
    const after = Date.now();

    expect(note.createdAt).toBeGreaterThanOrEqual(before);
    expect(note.createdAt).toBeLessThanOrEqual(after);
    expect(note.updatedAt).toBe(note.createdAt);
  });

  test("each note gets a new id", async () => {
    expect((await createNote(db, alice)).id).not.toBe(
      (await createNote(db, alice)).id,
    );
  });

  test("the returned content is not EMPTY_DOC itself", async () => {
    const note = await createNote(db, alice);
    note.content.content?.push({ type: "paragraph" });

    expect(EMPTY_DOC).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });
});

describe("listNotes", () => {
  test("orders by updated_at desc", async () => {
    const first = await createNote(db, alice, 1_000);
    const second = await createNote(db, alice, 2_000);
    const third = await createNote(db, alice, 3_000);
    await updateNote(db, alice, first.id, groceries, 4_000);

    expect((await listNotes(db, alice)).map((note) => note.id)).toEqual([
      first.id,
      third.id,
      second.id,
    ]);
  });

  test("returns only the given user's notes (NOTE-3)", async () => {
    const own = await createNote(db, alice, 1_000);
    await createNote(db, bob, 2_000);

    expect((await listNotes(db, alice)).map((note) => note.id)).toEqual([
      own.id,
    ]);
  });

  test("a user with no notes gets []", async () => {
    await createNote(db, bob);

    expect(await listNotes(db, alice)).toEqual([]);
  });

  test("returns the summary fields, with isShared from share_token", async () => {
    const shared = await createNote(db, alice, 1_000);
    const private_ = await createNote(db, alice, 2_000);
    await updateNote(db, alice, shared.id, groceries, 3_000);
    await enableShare(db, alice, shared.id, generateShareToken());

    expect(await listNotes(db, alice)).toEqual([
      { id: shared.id, title: "Groceries", updatedAt: 3_000, isShared: true },
      { id: private_.id, title: "", updatedAt: 2_000, isShared: false },
    ]);
  });
});

describe("getNote", () => {
  test("returns the owner's note with parsed content", async () => {
    const note = await createNote(db, alice, 1_000);
    await updateNote(db, alice, note.id, groceries, 2_000);

    expect(await getNote(db, alice, note.id)).toEqual({
      id: note.id,
      title: "Groceries",
      content: JSON.parse(groceries.content),
      shareToken: null,
      createdAt: 1_000,
      updatedAt: 2_000,
    });
  });

  test("another user's note → null (D24)", async () => {
    const note = await createNote(db, alice);

    expect(await getNote(db, bob, note.id)).toBeNull();
  });

  test("a missing id → null", async () => {
    expect(await getNote(db, alice, crypto.randomUUID())).toBeNull();
  });
});

describe("updateNote", () => {
  test("stores title and content and sets updated_at, keeping created_at", async () => {
    const note = await createNote(db, alice, 1_000);

    expect(await updateNote(db, alice, note.id, groceries, 2_000)).toBe(true);
    expect(await rawRow(db, note.id)).toMatchObject({
      title: "Groceries",
      content: groceries.content,
      created_at: 1_000,
      updated_at: 2_000,
    });
  });

  test("now defaults to the current time", async () => {
    const note = await createNote(db, alice, 1_000);
    const before = Date.now();
    await updateNote(db, alice, note.id, groceries);

    expect((await rawRow(db, note.id))?.updated_at).toBeGreaterThanOrEqual(
      before,
    );
  });

  test("keeps share_token (NOTE-16)", async () => {
    const note = await createNote(db, alice);
    const token = await enableShare(db, alice, note.id, generateShareToken());
    await updateNote(db, alice, note.id, groceries);

    expect((await rawRow(db, note.id))?.share_token).toBe(token);
    expect((await getSharedNote(db, token!))?.title).toBe("Groceries");
  });

  test("another user's note → false and the row is unchanged (D24)", async () => {
    const note = await createNote(db, alice, 1_000);
    const before = await rawRow(db, note.id);

    expect(await updateNote(db, bob, note.id, groceries, 2_000)).toBe(false);
    expect(await rawRow(db, note.id)).toEqual(before);
  });

  test("a missing id → false", async () => {
    expect(await updateNote(db, alice, crypto.randomUUID(), groceries)).toBe(
      false,
    );
  });
});

describe("deleteNote", () => {
  test("deletes the owner's note → true", async () => {
    const note = await createNote(db, alice);

    expect(await deleteNote(db, alice, note.id)).toBe(true);
    expect(await rawRow(db, note.id)).toBeNull();
  });

  test("another user's note → false and the row stays (D24)", async () => {
    const note = await createNote(db, alice);
    const before = await rawRow(db, note.id);

    expect(await deleteNote(db, bob, note.id)).toBe(false);
    expect(await rawRow(db, note.id)).toEqual(before);
  });

  test("a missing or already deleted id → false", async () => {
    const note = await createNote(db, alice);
    await deleteNote(db, alice, note.id);

    expect(await deleteNote(db, alice, note.id)).toBe(false);
  });
});

describe("enableShare", () => {
  test("stores and returns the token", async () => {
    const note = await createNote(db, alice);
    const token = generateShareToken();

    expect(await enableShare(db, alice, note.id, token)).toBe(token);
    expect((await getNote(db, alice, note.id))?.shareToken).toBe(token);
  });

  test("twice → the same token (SHARE-6)", async () => {
    const note = await createNote(db, alice);
    const first = await enableShare(db, alice, note.id, generateShareToken());

    expect(await enableShare(db, alice, note.id, generateShareToken())).toBe(
      first,
    );
    expect((await rawRow(db, note.id))?.share_token).toBe(first);
  });

  test("another user's note → null and nothing is stored", async () => {
    const note = await createNote(db, alice);

    expect(
      await enableShare(db, bob, note.id, generateShareToken()),
    ).toBeNull();
    expect((await rawRow(db, note.id))?.share_token).toBeNull();
  });

  test("a missing id → null", async () => {
    expect(
      await enableShare(db, alice, crypto.randomUUID(), generateShareToken()),
    ).toBeNull();
  });

  test("re-enabling after disableShare stores and returns the new token (SHARE-5)", async () => {
    const note = await createNote(db, alice);
    const oldToken = (await enableShare(
      db,
      alice,
      note.id,
      generateShareToken(),
    ))!;
    await disableShare(db, alice, note.id);
    const newToken = generateShareToken();

    expect(await enableShare(db, alice, note.id, newToken)).toBe(newToken);
    expect(newToken).not.toBe(oldToken);
    expect(await getSharedNote(db, oldToken)).toBeNull();
    expect(await getSharedNote(db, newToken)).not.toBeNull();
  });
});

describe("disableShare", () => {
  test("clears the token, so getSharedNote(oldToken) → null (D6)", async () => {
    const note = await createNote(db, alice);
    const token = (await enableShare(
      db,
      alice,
      note.id,
      generateShareToken(),
    ))!;

    expect(await disableShare(db, alice, note.id)).toBe(true);
    expect((await rawRow(db, note.id))?.share_token).toBeNull();
    expect(await getSharedNote(db, token)).toBeNull();
  });

  test("an owned note that isn't shared → true (D42)", async () => {
    const note = await createNote(db, alice);

    expect(await disableShare(db, alice, note.id)).toBe(true);
  });

  test("another user's note → false and its token stays (D42)", async () => {
    const note = await createNote(db, alice);
    const token = await enableShare(db, alice, note.id, generateShareToken());

    expect(await disableShare(db, bob, note.id)).toBe(false);
    expect((await rawRow(db, note.id))?.share_token).toBe(token);
  });

  test("a missing id → false", async () => {
    expect(await disableShare(db, alice, crypto.randomUUID())).toBe(false);
  });
});

describe("share toggles", () => {
  test("don't change updated_at (D32)", async () => {
    const note = await createNote(db, alice, 1_000);
    await enableShare(db, alice, note.id, generateShareToken());
    await disableShare(db, alice, note.id);
    await enableShare(db, alice, note.id, generateShareToken());

    expect((await rawRow(db, note.id))?.updated_at).toBe(1_000);
  });
});

describe("getSharedNote", () => {
  test("returns only title, content and updatedAt (D8)", async () => {
    const note = await createNote(db, alice, 1_000);
    await updateNote(db, alice, note.id, groceries, 2_000);
    const token = (await enableShare(
      db,
      alice,
      note.id,
      generateShareToken(),
    ))!;

    expect(await getSharedNote(db, token)).toEqual({
      title: "Groceries",
      content: JSON.parse(groceries.content),
      updatedAt: 2_000,
    });
  });

  test("an unknown token → null", async () => {
    await createNote(db, alice);

    expect(await getSharedNote(db, generateShareToken())).toBeNull();
  });

  test("after deleteNote → null", async () => {
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

describe("note table constraints", () => {
  // Valid JSON (a string) of exactly `bytes` UTF-8 bytes. Most of it is "€" (3 bytes, 1 UTF-16 unit),
  // so a CHECK that counted characters would accept both boundary cases.
  function jsonOfBytes(bytes: number): string {
    const euros = 20_000;
    const json = JSON.stringify(
      "€".repeat(euros) + "a".repeat(bytes - 2 - euros * 3),
    );
    expect(utf8ByteLength(json)).toBe(bytes);
    expect(json.length).toBeLessThan(CONTENT_MAX_BYTES);
    return json;
  }

  test("content of exactly 102 400 bytes is accepted (D40)", async () => {
    await insertRaw(db, alice, jsonOfBytes(CONTENT_MAX_BYTES));

    expect(await listNotes(db, alice)).toHaveLength(1);
  });

  test("a direct INSERT with content over 102 400 bytes fails the CHECK (D40)", async () => {
    await expect(
      insertRaw(db, alice, jsonOfBytes(CONTENT_MAX_BYTES + 1)),
    ).rejects.toThrow(/CHECK constraint failed/);
    expect(await listNotes(db, alice)).toEqual([]);
  });

  test("deleting a user row cascades to their notes", async () => {
    const note = await createNote(db, alice);
    const other = await createNote(db, bob);

    await db.execute({ sql: 'DELETE FROM "user" WHERE id = ?', args: [alice] });

    expect(await rawRow(db, note.id)).toBeNull();
    expect(await rawRow(db, other.id)).not.toBeNull();
  });
});
