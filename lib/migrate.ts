import type { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Applies every not-yet-applied .sql file in `dir`, in filename order, each in
// its own transaction, recording it in _migrations (§8). Returns names newly applied.
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
    .filter((file) => file.endsWith(".sql") && !applied.has(file))
    .sort();

  const record = db.query(
    "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)",
  );
  for (const name of pending) {
    const sql = readFileSync(join(dir, name), "utf8");
    db.transaction(() => {
      db.run(sql);
      record.run(name, Date.now());
    })();
  }
  return pending;
}
