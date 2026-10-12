import type { Client } from "@libsql/client";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { rowsOf } from "./open-database";

// Applies the .sql files in `dir` that aren't in _migrations yet, in filename order.
// Each file runs in its own transaction, so a failing file leaves no trace (§8).
export async function migrate(db: Client, dir: string): Promise<string[]> {
  await db.execute(`CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT PRIMARY KEY NOT NULL,
    applied_at INTEGER NOT NULL
  )`);

  const applied = new Set(
    rowsOf<{ name: string }>(
      await db.execute("SELECT name FROM _migrations"),
    ).map((row) => row.name),
  );
  const pending = readdirSync(dir)
    .filter((name) => name.endsWith(".sql") && !applied.has(name))
    .sort();

  for (const name of pending) {
    const transaction = await db.transaction("write");
    try {
      await transaction.executeMultiple(readFileSync(join(dir, name), "utf8"));
      await transaction.execute({
        sql: "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)",
        args: [name, Date.now()],
      });
      await transaction.commit();
    } catch (error) {
      throw new Error(`Migration ${name} failed`, { cause: error });
    } finally {
      transaction.close(); // rolls back unless committed
    }
  }
  return pending;
}
