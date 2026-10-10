import type { Database } from "bun:sqlite";
import { migrate } from "../migrate";
import { openDatabase } from "../open-database";

// Test helpers. They never import lib/db.ts, so tests don't open DB_PATH (D45).

export function createTestDb(): Database {
  const db = openDatabase(":memory:");
  migrate(db, "db/migrations");
  return db;
}

// Inserts a "user" row the way better-auth stores it on SQLite (dates as ISO strings,
// booleans as 0/1) and returns its id. The default email is unique per call.
export function insertTestUser(db: Database, email?: string): string {
  const id = crypto.randomUUID();
  const userEmail = email ?? `user-${id}@example.com`;
  const now = new Date().toISOString();
  db.query(
    `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
     VALUES (?, ?, ?, 0, ?, ?)`,
  ).run(id, userEmail, userEmail, now, now);
  return id;
}
