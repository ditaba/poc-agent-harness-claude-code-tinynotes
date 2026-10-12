import type { Client } from "@libsql/client";
import { migrate } from "../migrate";
import { openDatabase } from "../open-database";

// Test helpers. They never import lib/db.ts, so tests don't open TURSO_DATABASE_URL (D45).

// Each :memory: client is its own empty database.
export async function createTestDb(): Promise<Client> {
  const db = openDatabase(":memory:");
  await migrate(db, "db/migrations");
  return db;
}

// Inserts a "user" row the way better-auth stores it on SQLite (dates as ISO strings,
// booleans as 0/1) and returns its id. The default email is unique per call.
export async function insertTestUser(
  db: Client,
  email?: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const userEmail = email ?? `user-${id}@example.com`;
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
          VALUES (?, ?, ?, 0, ?, ?)`,
    args: [id, userEmail, userEmail, now, now],
  });
  return id;
}
