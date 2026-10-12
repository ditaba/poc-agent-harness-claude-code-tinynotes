export const MIN_SECRET_LENGTH = 32;

const HINT = "Copy .env.example to .env and set it.";

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

  return problems;
}
