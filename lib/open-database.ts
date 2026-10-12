import { Database } from "bun:sqlite";

// No side effects on import (D45): only openDatabase() opens a connection.
export function openDatabase(path: string): Database {
  const db = new Database(path, { create: true, strict: true });
  db.run("PRAGMA foreign_keys = ON");
  if (path !== ":memory:") db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
  return db;
}
