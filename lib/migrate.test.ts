import type { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "./migrate";
import { openDatabase } from "./open-database";

function tableNames(db: Database): string[] {
  return db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    )
    .all()
    .map((row) => row.name);
}

function recordedNames(db: Database): string[] {
  return db
    .query<{ name: string }, []>("SELECT name FROM _migrations ORDER BY rowid")
    .all()
    .map((row) => row.name);
}

describe("migrate", () => {
  test("a fresh DB applies 0001 then 0002 and returns both names", () => {
    const db = openDatabase(":memory:");

    expect(migrate(db, "db/migrations")).toEqual([
      "0001_better_auth.sql",
      "0002_note.sql",
    ]);
    expect(recordedNames(db)).toEqual([
      "0001_better_auth.sql",
      "0002_note.sql",
    ]);
    expect(tableNames(db)).toEqual([
      "_migrations",
      "account",
      "note",
      "session",
      "user",
      "verification",
    ]);
  });

  test("a second run applies nothing", () => {
    const db = openDatabase(":memory:");
    migrate(db, "db/migrations");

    expect(migrate(db, "db/migrations")).toEqual([]);
    expect(recordedNames(db)).toHaveLength(2);
  });

  describe("with a failing migration", () => {
    let dir: string;

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    test("throws, rolls the file back and doesn't record it", () => {
      dir = mkdtempSync(join(tmpdir(), "tinynotes-migrate-"));
      writeFileSync(join(dir, "0001_ok.sql"), "CREATE TABLE ok (x INTEGER);");
      writeFileSync(
        join(dir, "0002_bad.sql"),
        "CREATE TABLE partial (x INTEGER);\nINSERT INTO missing VALUES (1);",
      );
      const db = openDatabase(":memory:");

      expect(() => migrate(db, dir)).toThrow("Migration 0002_bad.sql failed");
      expect(tableNames(db)).toEqual(["_migrations", "ok"]);
      expect(recordedNames(db)).toEqual(["0001_ok.sql"]);
    });
  });
});
