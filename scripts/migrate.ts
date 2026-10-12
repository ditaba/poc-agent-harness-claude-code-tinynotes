import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { checkEnv, databaseUrl } from "../lib/env";
import { migrate } from "../lib/migrate";
import { openDatabase } from "../lib/open-database";

// `bun run db:migrate`, run first by dev/build/start (D36). Bun loads .env itself; on Vercel the env comes
// from the project settings, so `build` migrates the Turso database before each deploy (D49).
// Uses lib/open-database.ts, never lib/db.ts (D45).
const problems = checkEnv(process.env);
if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem);
  }
  process.exit(1);
}

const url = databaseUrl(process.env);
try {
  if (url.startsWith("file:")) {
    mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
  }
  const db = openDatabase(url, process.env.TURSO_AUTH_TOKEN);
  if (url.startsWith("file:")) {
    // Stored in the file, so it holds for every later connection.
    await db.execute("PRAGMA journal_mode = WAL");
  }
  const applied = await migrate(db, "db/migrations");
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
