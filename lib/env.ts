const SECRET_MIN_LENGTH = 32;

// Returns one message per problem, naming the variable; [] when the env is usable (D36).
// DB_PATH is optional: lib/db.ts and scripts/migrate.ts default it to data/app.db.
export function checkEnv(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];

  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    problems.push(
      "BETTER_AUTH_SECRET is missing. Copy .env.example to .env and set a random secret of at least 32 characters.",
    );
  } else if (secret.length < SECRET_MIN_LENGTH) {
    problems.push(
      `BETTER_AUTH_SECRET must be at least ${SECRET_MIN_LENGTH} characters (it has ${secret.length}). See .env.example.`,
    );
  }

  if (!env.BETTER_AUTH_URL) {
    problems.push(
      "BETTER_AUTH_URL is missing. Copy .env.example to .env and set it (e.g. http://localhost:3000).",
    );
  }

  return problems;
}
