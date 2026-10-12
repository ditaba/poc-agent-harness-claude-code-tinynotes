import type { Client } from "@libsql/client";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "./migrate";
import { openDatabase, rowsOf } from "./open-database";

async function tableNames(db: Client): Promise<string[]> {
  const result = await db.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  return rowsOf<{ name: string }>(result).map((row) => row.name);
}

async function recordedNames(db: Client): Promise<string[]> {
  const result = await db.execute(
    "SELECT name FROM _migrations ORDER BY rowid",
  );
  return rowsOf<{ name: string }>(result).map((row) => row.name);
}

describe("migrate", () => {
  test("a fresh DB applies 0001 then 0002 and returns both names", async () => {
    const db = openDatabase(":memory:");

    expect(await migrate(db, "db/migrations")).toEqual([
      "0001_better_auth.sql",
      "0002_note.sql",
    ]);
    expect(await recordedNames(db)).toEqual([
      "0001_better_auth.sql",
      "0002_note.sql",
    ]);
    expect(await tableNames(db)).toEqual([
      "_migrations",
      "account",
      "note",
      "session",
      "user",
      "verification",
    ]);
  });

  test("a second run applies nothing", async () => {
    const db = openDatabase(":memory:");
    await migrate(db, "db/migrations");

    expect(await migrate(db, "db/migrations")).toEqual([]);
    expect(await recordedNames(db)).toHaveLength(2);
  });

  describe("with a failing migration", () => {
    let dir: string;

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    test("throws, rolls the file back and doesn't record it", async () => {
      dir = mkdtempSync(join(tmpdir(), "tinynotes-migrate-"));
      writeFileSync(join(dir, "0001_ok.sql"), "CREATE TABLE ok (x INTEGER);");
      writeFileSync(
        join(dir, "0002_bad.sql"),
        "CREATE TABLE partial (x INTEGER);\nINSERT INTO missing VALUES (1);",
      );
      const db = openDatabase(":memory:");

      await expect(migrate(db, dir)).rejects.toThrow(
        "Migration 0002_bad.sql failed",
      );
      expect(await tableNames(db)).toEqual(["_migrations", "ok"]);
      expect(await recordedNames(db)).toEqual(["0001_ok.sql"]);
    });
  });
});
