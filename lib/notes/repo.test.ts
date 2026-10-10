import type { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
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

function rawRow(db: Database, id: string): RawNoteRow | null {
  return db
    .query<RawNoteRow, [string]>("SELECT * FROM note WHERE id = ?")
    .get(id);
}

function insertRaw(db: Database, userId: string, content: string): void {
  db.query(
    `INSERT INTO note (id, user_id, content, created_at, updated_at)
     VALUES (?, ?, ?, 0, 0)`,
  ).run(crypto.randomUUID(), userId, content);
}

let db: Database;
let alice: string;
let bob: string;

beforeEach(() => {
  db = createTestDb();
  alice = insertTestUser(db);
  bob = insertTestUser(db);
});

describe("createNote", () => {
  test('defaults: title "", EMPTY_DOC, a UUID id, created_at = updated_at = now (D27)', () => {
    const note = createNote(db, alice, 1_000);

    expect(note).toEqual({
      id: expect.stringMatching(UUID_PATTERN),
      title: "",
      content: EMPTY_DOC,
      shareToken: null,
      createdAt: 1_000,
      updatedAt: 1_000,
    });
    expect(getNote(db, alice, note.id)).toEqual(note);
    expect(rawRow(db, note.id)).toEqual({
      id: note.id,
      user_id: alice,
      title: "",
      content: JSON.stringify(EMPTY_DOC),
      share_token: null,
      created_at: 1_000,
      updated_at: 1_000,
    });
  });

  test("now defaults to the current time", () => {
    const before = Date.now();
    const note = createNote(db, alice);
    const after = Date.now();

    expect(note.createdAt).toBeGreaterThanOrEqual(before);
    expect(note.createdAt).toBeLessThanOrEqual(after);
    expect(note.updatedAt).toBe(note.createdAt);
  });

  test("each note gets a new id", () => {
    expect(createNote(db, alice).id).not.toBe(createNote(db, alice).id);
  });

  test("the returned content is not EMPTY_DOC itself", () => {
    const note = createNote(db, alice);
    note.content.content?.push({ type: "paragraph" });

    expect(EMPTY_DOC).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });
});

describe("listNotes", () => {
  test("orders by updated_at desc", () => {
    const first = createNote(db, alice, 1_000);
    const second = createNote(db, alice, 2_000);
    const third = createNote(db, alice, 3_000);
    updateNote(db, alice, first.id, groceries, 4_000);

    expect(listNotes(db, alice).map((note) => note.id)).toEqual([
      first.id,
      third.id,
      second.id,
    ]);
  });

  test("returns only the given user's notes (NOTE-3)", () => {
    const own = createNote(db, alice, 1_000);
    createNote(db, bob, 2_000);

    expect(listNotes(db, alice).map((note) => note.id)).toEqual([own.id]);
  });

  test("a user with no notes gets []", () => {
    createNote(db, bob);

    expect(listNotes(db, alice)).toEqual([]);
  });

  test("returns the summary fields, with isShared from share_token", () => {
    const shared = createNote(db, alice, 1_000);
    const private_ = createNote(db, alice, 2_000);
    updateNote(db, alice, shared.id, groceries, 3_000);
    enableShare(db, alice, shared.id, generateShareToken());

    expect(listNotes(db, alice)).toEqual([
      { id: shared.id, title: "Groceries", updatedAt: 3_000, isShared: true },
      { id: private_.id, title: "", updatedAt: 2_000, isShared: false },
    ]);
  });
});

describe("getNote", () => {
  test("returns the owner's note with parsed content", () => {
    const note = createNote(db, alice, 1_000);
    updateNote(db, alice, note.id, groceries, 2_000);

    expect(getNote(db, alice, note.id)).toEqual({
      id: note.id,
      title: "Groceries",
      content: JSON.parse(groceries.content),
      shareToken: null,
      createdAt: 1_000,
      updatedAt: 2_000,
    });
  });

  test("another user's note → null (D24)", () => {
    const note = createNote(db, alice);

    expect(getNote(db, bob, note.id)).toBeNull();
  });

  test("a missing id → null", () => {
    expect(getNote(db, alice, crypto.randomUUID())).toBeNull();
  });
});

describe("updateNote", () => {
  test("stores title and content and sets updated_at, keeping created_at", () => {
    const note = createNote(db, alice, 1_000);

    expect(updateNote(db, alice, note.id, groceries, 2_000)).toBe(true);
    expect(rawRow(db, note.id)).toMatchObject({
      title: "Groceries",
      content: groceries.content,
      created_at: 1_000,
      updated_at: 2_000,
    });
  });

  test("now defaults to the current time", () => {
    const note = createNote(db, alice, 1_000);
    const before = Date.now();
    updateNote(db, alice, note.id, groceries);

    expect(rawRow(db, note.id)?.updated_at).toBeGreaterThanOrEqual(before);
  });

  test("keeps share_token (NOTE-16)", () => {
    const note = createNote(db, alice);
    const token = enableShare(db, alice, note.id, generateShareToken());
    updateNote(db, alice, note.id, groceries);

    expect(rawRow(db, note.id)?.share_token).toBe(token);
    expect(getSharedNote(db, token!)?.title).toBe("Groceries");
  });

  test("another user's note → false and the row is unchanged (D24)", () => {
    const note = createNote(db, alice, 1_000);
    const before = rawRow(db, note.id);

    expect(updateNote(db, bob, note.id, groceries, 2_000)).toBe(false);
    expect(rawRow(db, note.id)).toEqual(before);
  });

  test("a missing id → false", () => {
    expect(updateNote(db, alice, crypto.randomUUID(), groceries)).toBe(false);
  });
});

describe("deleteNote", () => {
  test("deletes the owner's note → true", () => {
    const note = createNote(db, alice);

    expect(deleteNote(db, alice, note.id)).toBe(true);
    expect(rawRow(db, note.id)).toBeNull();
  });

  test("another user's note → false and the row stays (D24)", () => {
    const note = createNote(db, alice);
    const before = rawRow(db, note.id);

    expect(deleteNote(db, bob, note.id)).toBe(false);
    expect(rawRow(db, note.id)).toEqual(before);
  });

  test("a missing or already deleted id → false", () => {
    const note = createNote(db, alice);
    deleteNote(db, alice, note.id);

    expect(deleteNote(db, alice, note.id)).toBe(false);
  });
});

describe("enableShare", () => {
  test("stores and returns the token", () => {
    const note = createNote(db, alice);
    const token = generateShareToken();

    expect(enableShare(db, alice, note.id, token)).toBe(token);
    expect(getNote(db, alice, note.id)?.shareToken).toBe(token);
  });

  test("twice → the same token (SHARE-6)", () => {
    const note = createNote(db, alice);
    const first = enableShare(db, alice, note.id, generateShareToken());

    expect(enableShare(db, alice, note.id, generateShareToken())).toBe(first);
    expect(rawRow(db, note.id)?.share_token).toBe(first);
  });

  test("another user's note → null and nothing is stored", () => {
    const note = createNote(db, alice);

    expect(enableShare(db, bob, note.id, generateShareToken())).toBeNull();
    expect(rawRow(db, note.id)?.share_token).toBeNull();
  });

  test("a missing id → null", () => {
    expect(
      enableShare(db, alice, crypto.randomUUID(), generateShareToken()),
    ).toBeNull();
  });

  test("re-enabling after disableShare stores and returns the new token (SHARE-5)", () => {
    const note = createNote(db, alice);
    const oldToken = enableShare(db, alice, note.id, generateShareToken())!;
    disableShare(db, alice, note.id);
    const newToken = generateShareToken();

    expect(enableShare(db, alice, note.id, newToken)).toBe(newToken);
    expect(newToken).not.toBe(oldToken);
    expect(getSharedNote(db, oldToken)).toBeNull();
    expect(getSharedNote(db, newToken)).not.toBeNull();
  });
});

describe("disableShare", () => {
  test("clears the token, so getSharedNote(oldToken) → null (D6)", () => {
    const note = createNote(db, alice);
    const token = enableShare(db, alice, note.id, generateShareToken())!;

    expect(disableShare(db, alice, note.id)).toBe(true);
    expect(rawRow(db, note.id)?.share_token).toBeNull();
    expect(getSharedNote(db, token)).toBeNull();
  });

  test("an owned note that isn't shared → true (D42)", () => {
    const note = createNote(db, alice);

    expect(disableShare(db, alice, note.id)).toBe(true);
  });

  test("another user's note → false and its token stays (D42)", () => {
    const note = createNote(db, alice);
    const token = enableShare(db, alice, note.id, generateShareToken());

    expect(disableShare(db, bob, note.id)).toBe(false);
    expect(rawRow(db, note.id)?.share_token).toBe(token);
  });

  test("a missing id → false", () => {
    expect(disableShare(db, alice, crypto.randomUUID())).toBe(false);
  });
});

describe("share toggles", () => {
  test("don't change updated_at (D32)", () => {
    const note = createNote(db, alice, 1_000);
    enableShare(db, alice, note.id, generateShareToken());
    disableShare(db, alice, note.id);
    enableShare(db, alice, note.id, generateShareToken());

    expect(rawRow(db, note.id)?.updated_at).toBe(1_000);
  });
});

describe("getSharedNote", () => {
  test("returns only title, content and updatedAt (D8)", () => {
    const note = createNote(db, alice, 1_000);
    updateNote(db, alice, note.id, groceries, 2_000);
    const token = enableShare(db, alice, note.id, generateShareToken())!;

    expect(getSharedNote(db, token)).toEqual({
      title: "Groceries",
      content: JSON.parse(groceries.content),
      updatedAt: 2_000,
    });
  });

  test("an unknown token → null", () => {
    createNote(db, alice);

    expect(getSharedNote(db, generateShareToken())).toBeNull();
  });

  test("after deleteNote → null", () => {
    const note = createNote(db, alice);
    const token = enableShare(db, alice, note.id, generateShareToken())!;
    deleteNote(db, alice, note.id);

    expect(getSharedNote(db, token)).toBeNull();
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

  test("content of exactly 102 400 bytes is accepted (D40)", () => {
    expect(() =>
      insertRaw(db, alice, jsonOfBytes(CONTENT_MAX_BYTES)),
    ).not.toThrow();
  });

  test("a direct INSERT with content over 102 400 bytes fails the CHECK (D40)", () => {
    expect(() =>
      insertRaw(db, alice, jsonOfBytes(CONTENT_MAX_BYTES + 1)),
    ).toThrow(/CHECK constraint failed/);
    expect(listNotes(db, alice)).toEqual([]);
  });

  test("deleting a user row cascades to their notes", () => {
    const note = createNote(db, alice);
    const other = createNote(db, bob);

    db.query('DELETE FROM "user" WHERE id = ?').run(alice);

    expect(rawRow(db, note.id)).toBeNull();
    expect(rawRow(db, other.id)).not.toBeNull();
  });
});
