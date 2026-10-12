export const MIN_SECRET_LENGTH = 32;

const DEFAULT_DATABASE_URL = "file:data/app.db";
const HINT =
  "Set it in .env (copy .env.example) or in your host's environment variables.";

// Without TURSO_DATABASE_URL the app uses a local SQLite file (D49).
export function databaseUrl(env: Record<string, string | undefined>): string {
  return env.TURSO_DATABASE_URL || DEFAULT_DATABASE_URL;
}

// Returns one message per problem, each naming the variable (D36). [] when OK.
export function checkEnv(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];

  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    problems.push(`BETTER_AUTH_SECRET is missing. ${HINT}`);
  } else if (secret.length < MIN_SECRET_LENGTH) {
    problems.push(
      `BETTER_AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${secret.length}). ${HINT}`,
    );
  }

  if (!env.BETTER_AUTH_URL) {
    problems.push(`BETTER_AUTH_URL is missing. ${HINT}`);
  }

  const url = databaseUrl(env);
  // Vercel sets VERCEL=1. Its functions have no lasting disk, so a file: database
  // would lose every write (D49).
  if (env.VERCEL && url.startsWith("file:")) {
    problems.push(
      `TURSO_DATABASE_URL must point to a Turso database (libsql://…) on Vercel, where a local SQLite file isn't kept. ${HINT}`,
    );
  }
  if (url.includes(".turso.io") && !env.TURSO_AUTH_TOKEN) {
    problems.push(
      `TURSO_AUTH_TOKEN is missing (create one with \`turso db tokens create <database>\`). ${HINT}`,
    );
  }

  return problems;
}
