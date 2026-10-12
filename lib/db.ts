import type { Database } from "bun:sqlite";
import { openDatabase } from "./open-database";

// Importing this opens DB_PATH, so only app code imports it (D45). One shared
// connection for the app and better-auth (D29), cached on globalThis in dev so
// HMR reloads don't open extra connections (R7).
const globalForDb = globalThis as unknown as { db?: Database };

export const db: Database =
  globalForDb.db ?? openDatabase(process.env.DB_PATH ?? "data/app.db");

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
