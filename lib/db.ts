import type { Client } from "@libsql/client";
import { databaseUrl } from "./env";
import { openDatabase } from "./open-database";

// Importing this opens TURSO_DATABASE_URL, so only app code imports it (D45). One
// shared client for the app and better-auth (D29), cached on globalThis in dev so
// HMR reloads don't open extra clients (R7).
const globalForDb = globalThis as unknown as { db?: Client };

export const db: Client =
  globalForDb.db ??
  openDatabase(databaseUrl(process.env), process.env.TURSO_AUTH_TOKEN);

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
