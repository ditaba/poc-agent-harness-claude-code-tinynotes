import type { Database } from "bun:sqlite";
import { migrate } from "../migrate";
import { openDatabase } from "../open-database";

// Test helpers: never import lib/db.ts here (D45).

export function createTestDb(): Database {
  const db = openDatabase(":memory:");
  migrate(db, "db/migrations");
  return db;
}

// Inserts a "user" row directly as a fixture and returns its id.
export function insertTestUser(
  db: Database,
  email = `user-${crypto.randomUUID()}@example.com`,
): string {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.query(
    `INSERT INTO "user" (id, name, email, emailVerified, image, createdAt, updatedAt)
     VALUES (?, ?, ?, 0, NULL, ?, ?)`,
  ).run(id, email, email, now, now);
  return id;
}
