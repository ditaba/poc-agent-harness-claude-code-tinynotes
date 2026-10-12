import { describe, expect, test } from "bun:test";
import { openDatabase, rowsOf } from "./open-database";

async function pragma(
  db: ReturnType<typeof openDatabase>,
  name: string,
): Promise<unknown> {
  const [row] = rowsOf<Record<string, unknown>>(
    await db.execute(`PRAGMA ${name}`),
  );
  return Object.values(row)[0];
}

describe("openDatabase", () => {
  test("has foreign keys on and a 5000 ms busy timeout", async () => {
    const db = openDatabase(":memory:");
    expect(await pragma(db, "foreign_keys")).toBe(1);
    expect(await pragma(db, "busy_timeout")).toBe(5000);
    db.close();
  });
});

describe("rowsOf", () => {
  test("returns plain objects keyed by column name", async () => {
    const db = openDatabase(":memory:");
    const result = await db.execute("SELECT 1 AS a, 'x' AS b");
    expect(rowsOf(result)).toEqual([{ a: 1, b: "x" }]);
    db.close();
  });
});
