import type { Database } from "bun:sqlite";
import { openDatabase } from "./open-database";

// Importing this opens DB_PATH, so only app code (pages, actions, lib/auth.ts) imports it (D45).
// The app and better-auth share this one connection (D29). Dev HMR re-evaluates modules, so the
// connection is cached on globalThis to avoid opening a new one on every reload (R7).
const globalForDb = globalThis as typeof globalThis & {
  tinynotesDb?: Database;
};

export const db =
  globalForDb.tinynotesDb ?? openDatabase(process.env.DB_PATH ?? "data/app.db");

if (process.env.NODE_ENV !== "production") {
  globalForDb.tinynotesDb = db;
}
