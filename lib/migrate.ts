import type { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Applies the .sql files in `dir` that aren't in _migrations yet, in filename order.
// Each file runs in its own transaction, so a failing file leaves no trace (§8).
export function migrate(db: Database, dir: string): string[] {
  db.run(`CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT PRIMARY KEY NOT NULL,
    applied_at INTEGER NOT NULL
  )`);

  const applied = new Set(
    db
      .query<{ name: string }, []>("SELECT name FROM _migrations")
      .all()
      .map((row) => row.name),
  );
  const pending = readdirSync(dir)
    .filter((name) => name.endsWith(".sql") && !applied.has(name))
    .sort();

  const record = db.query(
    "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)",
  );
  const apply = db.transaction((name: string) => {
    db.run(readFileSync(join(dir, name), "utf8"));
    record.run(name, Date.now());
  });

  for (const name of pending) {
    try {
      apply(name);
    } catch (error) {
      throw new Error(`Migration ${name} failed`, { cause: error });
    }
  }
  return pending;
}
