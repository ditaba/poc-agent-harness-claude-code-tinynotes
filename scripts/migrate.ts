import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { checkEnv } from "../lib/env";
import { migrate } from "../lib/migrate";
import { openDatabase } from "../lib/open-database";

// CLI wrapper around lib/migrate.ts, run before dev/build/start (D36).
const problems = checkEnv(process.env);
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

const dbPath = process.env.DB_PATH ?? "data/app.db";

try {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = openDatabase(dbPath);
  const applied = migrate(db, "db/migrations");
  db.close();
  if (applied.length === 0) {
    console.log("No pending migrations.");
  } else {
    for (const name of applied) console.log(`Applied ${name}`);
  }
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
}
