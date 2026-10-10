import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { checkEnv } from "../lib/env";
import { migrate } from "../lib/migrate";
import { openDatabase } from "../lib/open-database";

// `bun run db:migrate`, run first by dev/build/start (D36). Bun loads .env itself.
// Uses lib/open-database.ts, never lib/db.ts (D45).
const problems = checkEnv(process.env);
if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem);
  }
  process.exit(1);
}

const dbPath = process.env.DB_PATH ?? "data/app.db";
try {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = openDatabase(dbPath);
  const applied = migrate(db, "db/migrations");
  db.close();
  if (applied.length > 0) {
    console.log(`Applied migrations: ${applied.join(", ")}`);
  } else {
    console.log("No pending migrations.");
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
