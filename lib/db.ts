import type { Client } from "@libsql/client";
import { databaseUrl } from "./env";
import { openDatabase } from "./open-database";

// Importing this opens TURSO_DATABASE_URL, so only app code (pages, actions, lib/auth.ts) imports it (D45).
// The app and better-auth share this one client (D29). Dev HMR re-evaluates modules, so the client is
// cached on globalThis to avoid opening a new one on every reload (R7).
const globalForDb = globalThis as typeof globalThis & {
  tinynotesDb?: Client;
};

export const db =
  globalForDb.tinynotesDb ??
  openDatabase(databaseUrl(process.env), process.env.TURSO_AUTH_TOKEN);

if (process.env.NODE_ENV !== "production") {
  globalForDb.tinynotesDb = db;
}
