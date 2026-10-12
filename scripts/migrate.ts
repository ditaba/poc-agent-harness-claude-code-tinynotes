import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { checkEnv, databaseUrl } from "../lib/env";
import { migrate } from "../lib/migrate";
import { openDatabase } from "../lib/open-database";

// CLI wrapper around lib/migrate.ts, run before dev/build/start (D36). On Vercel the
// env comes from the project settings, so `build` migrates Turso before each deploy (D49).
const problems = checkEnv(process.env);
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

const url = databaseUrl(process.env);
const isFile = url.startsWith("file:");

try {
  if (isFile)
    mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
  const db = openDatabase(url, process.env.TURSO_AUTH_TOKEN);
  // Stored in the file, so it holds for every later connection (R7).
  if (isFile) await db.execute("PRAGMA journal_mode = WAL");
  const applied = await migrate(db, "db/migrations");
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
