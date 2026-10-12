import type { Client } from "@libsql/client";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { rowsOf } from "./open-database";

// Applies every not-yet-applied .sql file in `dir`, in filename order, each in
// its own transaction, recording it in _migrations (§8). Returns names newly applied.
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
    .filter((file) => file.endsWith(".sql") && !applied.has(file))
    .sort();

  for (const name of pending) {
    const sql = readFileSync(join(dir, name), "utf8");
    const transaction = await db.transaction("write");
    try {
      await transaction.executeMultiple(sql);
      await transaction.execute({
        sql: "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)",
        args: [name, Date.now()],
      });
      await transaction.commit();
    } finally {
      transaction.close(); // rolls back unless committed
    }
  }
  return pending;
}
