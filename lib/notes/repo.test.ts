import type { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
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

let db: Database;
let alice: string;
let bob: string;

function rawRow(id: string) {
  return db.query(`SELECT * FROM note WHERE id = ?`).get(id);
}

beforeEach(() => {
  db = createTestDb();
  alice = insertTestUser(db);
  bob = insertTestUser(db);
});

describe("createNote / getNote / listNotes", () => {
  test("createNote defaults: empty title, EMPTY_DOC, uuid id, timestamps = now (D27)", () => {
    const note = createNote(db, alice, 1_000);
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
    expect(getNote(db, alice, note.id)).toEqual(note);
  });

  test("listNotes is ordered by updated_at desc and scoped to the user", () => {
    const first = createNote(db, alice, 1_000);
    const second = createNote(db, alice, 2_000);
    const third = createNote(db, alice, 3_000);
    createNote(db, bob, 4_000);
    updateNote(db, alice, first.id, savedInput, 5_000);
    enableShare(db, alice, second.id, generateShareToken());

    expect(listNotes(db, alice)).toEqual([
      { id: first.id, title: "Saved", updatedAt: 5_000, isShared: false },
      { id: third.id, title: "", updatedAt: 3_000, isShared: false },
      { id: second.id, title: "", updatedAt: 2_000, isShared: true },
    ]);
    expect(listNotes(db, bob)).toHaveLength(1);
  });

  test("getNote for another user → null (D24)", () => {
    const note = createNote(db, alice);
    expect(getNote(db, bob, note.id)).toBeNull();
    expect(getNote(db, alice, crypto.randomUUID())).toBeNull();
  });
});

describe("updateNote / deleteNote", () => {
  test("updateNote for another user → false and the row is unchanged (D24)", () => {
    const note = createNote(db, alice, 1_000);
    const before = rawRow(note.id);
    expect(updateNote(db, bob, note.id, savedInput, 2_000)).toBe(false);
    expect(rawRow(note.id)).toEqual(before);
  });

  test("updateNote sets title, content, updated_at and keeps share_token (NOTE-16)", () => {
    const note = createNote(db, alice, 1_000);
    const token = enableShare(db, alice, note.id, generateShareToken());
    expect(updateNote(db, alice, note.id, savedInput, 2_000)).toBe(true);
    expect(getNote(db, alice, note.id)).toEqual({
      id: note.id,
      title: "Saved",
      content: JSON.parse(savedInput.content),
      shareToken: token,
      createdAt: 1_000,
      updatedAt: 2_000,
    });
  });

  test("deleteNote for another user → false and the row stays (D24)", () => {
    const note = createNote(db, alice);
    expect(deleteNote(db, bob, note.id)).toBe(false);
    expect(getNote(db, alice, note.id)).not.toBeNull();
    expect(deleteNote(db, alice, note.id)).toBe(true);
    expect(getNote(db, alice, note.id)).toBeNull();
  });
});

describe("sharing", () => {
  test("enableShare twice → the same token (SHARE-6)", () => {
    const note = createNote(db, alice);
    const token = generateShareToken();
    expect(enableShare(db, alice, note.id, token)).toBe(token);
    expect(enableShare(db, alice, note.id, generateShareToken())).toBe(token);
  });

  test("enableShare on another user's note → null and no token is stored", () => {
    const note = createNote(db, alice);
    expect(enableShare(db, bob, note.id, generateShareToken())).toBeNull();
    expect(getNote(db, alice, note.id)?.shareToken).toBeNull();
  });

  test("getSharedNote returns title, content and updatedAt for an active token", () => {
    const note = createNote(db, alice, 1_000);
    updateNote(db, alice, note.id, savedInput, 2_000);
    const token = enableShare(db, alice, note.id, generateShareToken())!;
    expect(getSharedNote(db, token)).toEqual({
      title: "Saved",
      content: JSON.parse(savedInput.content),
      updatedAt: 2_000,
    });
  });

  test("disableShare → getSharedNote(oldToken) is null; re-enabling returns the new token", () => {
    const note = createNote(db, alice);
    const oldToken = enableShare(db, alice, note.id, generateShareToken())!;
    expect(disableShare(db, alice, note.id)).toBe(true);
    expect(getSharedNote(db, oldToken)).toBeNull();

    const newToken = generateShareToken();
    expect(enableShare(db, alice, note.id, newToken)).toBe(newToken);
    expect(getSharedNote(db, newToken)).not.toBeNull();
    expect(getSharedNote(db, oldToken)).toBeNull();
  });

  test("disableShare on an owned private note → true; on another user's note → false (D42)", () => {
    const note = createNote(db, alice);
    expect(disableShare(db, alice, note.id)).toBe(true);

    const token = enableShare(db, alice, note.id, generateShareToken())!;
    expect(disableShare(db, bob, note.id)).toBe(false);
    expect(getSharedNote(db, token)).not.toBeNull();
  });

  test("share toggles don't change updated_at (D32)", () => {
    const note = createNote(db, alice, 1_000);
    enableShare(db, alice, note.id, generateShareToken());
    expect(getNote(db, alice, note.id)?.updatedAt).toBe(1_000);
    disableShare(db, alice, note.id);
    expect(getNote(db, alice, note.id)?.updatedAt).toBe(1_000);
  });

  test("getSharedNote after deleteNote → null", () => {
    const note = createNote(db, alice);
    const token = enableShare(db, alice, note.id, generateShareToken())!;
    deleteNote(db, alice, note.id);
    expect(getSharedNote(db, token)).toBeNull();
  });
});

describe("schema constraints", () => {
  function insertWithContent(content: string) {
    db.query(
      `INSERT INTO note (id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, '', ?, 0, 0)`,
    ).run(crypto.randomUUID(), alice, content);
  }

  test("direct INSERT with content over 102 400 bytes fails the CHECK (D40)", () => {
    // JSON string literal: 2 quote bytes + text.
    expect(() => insertWithContent(`"${"a".repeat(102_398)}"`)).not.toThrow();
    expect(() => insertWithContent(`"${"a".repeat(102_399)}"`)).toThrow(
      /CHECK constraint failed/,
    );
  });

  test("deleting a user row cascades to their notes", () => {
    createNote(db, alice);
    createNote(db, alice);
    createNote(db, bob);
    db.query(`DELETE FROM "user" WHERE id = ?`).run(alice);
    expect(
      db.query(`SELECT COUNT(*) AS n FROM note WHERE user_id = ?`).get(alice),
    ).toEqual({ n: 0 });
    expect(listNotes(db, bob)).toHaveLength(1);
  });
});
