import { Database } from "bun:sqlite";

// No side effects on import: only lib/db.ts opens DB_PATH (D45).
export function openDatabase(path: string): Database {
  const db = new Database(path);
  db.run("PRAGMA foreign_keys = ON");
  if (path !== ":memory:") {
    db.run("PRAGMA journal_mode = WAL");
  }
  db.run("PRAGMA busy_timeout = 5000");
  return db;
}
