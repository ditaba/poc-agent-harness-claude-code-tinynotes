const SECRET_MIN_LENGTH = 32;
const DEFAULT_DATABASE_URL = "file:data/app.db";

// TURSO_DATABASE_URL is optional: without it the app uses a local SQLite file (D49).
export function databaseUrl(env: Record<string, string | undefined>): string {
  return env.TURSO_DATABASE_URL || DEFAULT_DATABASE_URL;
}

// Returns one message per problem, naming the variable; [] when the env is usable (D36).
export function checkEnv(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];

  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    problems.push(
      "BETTER_AUTH_SECRET is missing. Set it in .env (copy .env.example) or in your host's environment variables, to a random secret of at least 32 characters.",
    );
  } else if (secret.length < SECRET_MIN_LENGTH) {
    problems.push(
      `BETTER_AUTH_SECRET must be at least ${SECRET_MIN_LENGTH} characters (it has ${secret.length}). See .env.example.`,
    );
  }

  if (!env.BETTER_AUTH_URL) {
    problems.push(
      "BETTER_AUTH_URL is missing. Set it in .env (copy .env.example) or in your host's environment variables, to the app's origin (e.g. http://localhost:3000).",
    );
  }

  const url = databaseUrl(env);
  // Vercel sets VERCEL=1. Its functions have no lasting disk, so a file: database would lose every write.
  if (env.VERCEL && url.startsWith("file:")) {
    problems.push(
      "TURSO_DATABASE_URL must point to a Turso database (libsql://…) on Vercel, where a local SQLite file isn't kept. See .env.example.",
    );
  }
  if (url.includes(".turso.io") && !env.TURSO_AUTH_TOKEN) {
    problems.push(
      "TURSO_AUTH_TOKEN is missing. Create one with `turso db tokens create <database>` and set it next to TURSO_DATABASE_URL. See .env.example.",
    );
  }

  return problems;
}
