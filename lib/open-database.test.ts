import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "./open-database";

function pragma(db: ReturnType<typeof openDatabase>, name: string): unknown {
  const row = db.query(`PRAGMA ${name}`).get() as Record<string, unknown>;
  return Object.values(row)[0];
}

describe("openDatabase", () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  test(":memory: sets foreign_keys and busy_timeout, skips WAL", () => {
    const db = openDatabase(":memory:");
    expect(pragma(db, "foreign_keys")).toBe(1);
    expect(pragma(db, "busy_timeout")).toBe(5000);
    expect(pragma(db, "journal_mode")).toBe("memory");
    db.close();
  });

  test("file DB uses WAL", () => {
    tempDir = mkdtempSync(join(tmpdir(), "tinynotes-open-"));
    const db = openDatabase(join(tempDir, "test.db"));
    expect(pragma(db, "journal_mode")).toBe("wal");
    expect(pragma(db, "foreign_keys")).toBe(1);
    expect(pragma(db, "busy_timeout")).toBe(5000);
    db.close();
  });
});
