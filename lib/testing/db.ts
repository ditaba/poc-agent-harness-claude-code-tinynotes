import type { Client } from "@libsql/client";
import { migrate } from "../migrate";
import { openDatabase } from "../open-database";

// Test helpers: never import lib/db.ts here (D45).

// Each :memory: client is its own empty database.
export async function createTestDb(): Promise<Client> {
  const db = openDatabase(":memory:");
  await migrate(db, "db/migrations");
  return db;
}

// Inserts a "user" row directly as a fixture and returns its id.
export async function insertTestUser(
  db: Client,
  email = `user-${crypto.randomUUID()}@example.com`,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO "user" (id, name, email, emailVerified, image, createdAt, updatedAt)
          VALUES (?, ?, ?, 0, NULL, ?, ?)`,
    args: [id, email, email, now, now],
  });
  return id;
}
