import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "./migrate";
import { openDatabase } from "./open-database";

const MIGRATIONS = "db/migrations";

function appliedNames(db: ReturnType<typeof openDatabase>): string[] {
  return db
    .query<{ name: string }, []>("SELECT name FROM _migrations ORDER BY name")
    .all()
    .map((row) => row.name);
}

function tableNames(db: ReturnType<typeof openDatabase>): string[] {
  return db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    )
    .all()
    .map((row) => row.name);
}

describe("migrate", () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  test("fresh DB applies 0001, 0002 in order and returns both names", () => {
    const db = openDatabase(":memory:");
    expect(migrate(db, MIGRATIONS)).toEqual([
      "0001_better_auth.sql",
      "0002_note.sql",
    ]);
    expect(appliedNames(db)).toEqual(["0001_better_auth.sql", "0002_note.sql"]);
    expect(tableNames(db)).toEqual(
      expect.arrayContaining([
        "_migrations",
        "user",
        "session",
        "account",
        "verification",
        "note",
      ]),
    );
  });

  test("second run applies nothing", () => {
    const db = openDatabase(":memory:");
    migrate(db, MIGRATIONS);
    expect(migrate(db, MIGRATIONS)).toEqual([]);
  });

  test("failing migration rolls back and is not recorded", () => {
    tempDir = mkdtempSync(join(tmpdir(), "tinynotes-migrate-"));
    writeFileSync(join(tempDir, "0001_ok.sql"), "CREATE TABLE ok (id TEXT);");
    writeFileSync(
      join(tempDir, "0002_bad.sql"),
      "CREATE TABLE partial (id TEXT);\nTHIS IS NOT SQL;",
    );
    const db = openDatabase(":memory:");

    expect(() => migrate(db, tempDir!)).toThrow();
    expect(appliedNames(db)).toEqual(["0001_ok.sql"]);
    expect(tableNames(db)).toContain("ok");
    expect(tableNames(db)).not.toContain("partial");
  });
});
