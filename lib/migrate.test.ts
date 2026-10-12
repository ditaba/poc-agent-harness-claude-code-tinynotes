import type { Client } from "@libsql/client";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrate } from "./migrate";
import { openDatabase, rowsOf } from "./open-database";

const MIGRATIONS = "db/migrations";

async function appliedNames(db: Client): Promise<string[]> {
  const result = await db.execute("SELECT name FROM _migrations ORDER BY name");
  return rowsOf<{ name: string }>(result).map((row) => row.name);
}

async function tableNames(db: Client): Promise<string[]> {
  const result = await db.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  return rowsOf<{ name: string }>(result).map((row) => row.name);
}

describe("migrate", () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  test("fresh DB applies 0001, 0002 in order and returns both names", async () => {
    const db = openDatabase(":memory:");
    expect(await migrate(db, MIGRATIONS)).toEqual([
      "0001_better_auth.sql",
      "0002_note.sql",
    ]);
    expect(await appliedNames(db)).toEqual([
      "0001_better_auth.sql",
      "0002_note.sql",
    ]);
    expect(await tableNames(db)).toEqual(
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

  test("second run applies nothing", async () => {
    const db = openDatabase(":memory:");
    await migrate(db, MIGRATIONS);
    expect(await migrate(db, MIGRATIONS)).toEqual([]);
  });

  test("failing migration rolls back and is not recorded", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "tinynotes-migrate-"));
    writeFileSync(join(tempDir, "0001_ok.sql"), "CREATE TABLE ok (id TEXT);");
    writeFileSync(
      join(tempDir, "0002_bad.sql"),
      "CREATE TABLE partial (id TEXT);\nTHIS IS NOT SQL;",
    );
    const db = openDatabase(":memory:");

    await expect(migrate(db, tempDir)).rejects.toThrow();
    expect(await appliedNames(db)).toEqual(["0001_ok.sql"]);
    expect(await tableNames(db)).toContain("ok");
    expect(await tableNames(db)).not.toContain("partial");
  });
});
