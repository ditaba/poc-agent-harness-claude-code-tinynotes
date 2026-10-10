const INVALID_EMAIL = "Enter a valid email address.";
const PASSWORD_LENGTH = "Password must be 8–128 characters.";
const TOO_MANY_ATTEMPTS =
  "Too many attempts. Please wait a minute and try again.";
const GENERIC = "Something went wrong. Please try again.";

// better-auth 1.7.7 BASE_ERROR_CODES → §7 copy. A duplicate sign-up returns
// USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL; USER_ALREADY_EXISTS is mapped too (§7).
const MESSAGES_BY_CODE = new Map<string, string>([
  ["INVALID_EMAIL_OR_PASSWORD", "Invalid email or password."],
  ["USER_ALREADY_EXISTS", "An account with this email already exists."],
  [
    "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
    "An account with this email already exists.",
  ],
  ["PASSWORD_TOO_SHORT", PASSWORD_LENGTH],
  ["PASSWORD_TOO_LONG", PASSWORD_LENGTH],
  ["INVALID_EMAIL", INVALID_EMAIL],
]);

// Sign-up's body schema rejects a malformed email or an empty password before its handler runs, so those
// arrive as VALIDATION_ERROR with a "[body.<field>] …" message instead of INVALID_EMAIL (§7).
const MESSAGES_BY_INVALID_FIELD = new Map<string, string>([
  ["email", INVALID_EMAIL],
  ["password", PASSWORD_LENGTH],
]);

// `error` is authClient's error object ({ code?, message?, status, statusText }), or null for a network
// failure (the call threw). The rate limiter's 429 body has a message but no code (§12 R10).
export function authErrorMessage(
  error: { code?: string; message?: string; status?: number } | null,
): string {
  if (!error) return GENERIC;
  if (error.status === 429) return TOO_MANY_ATTEMPTS;
  if (error.code === "VALIDATION_ERROR") {
    const field = error.message?.match(/^\[body\.(\w+)\]/)?.[1];
    return (field && MESSAGES_BY_INVALID_FIELD.get(field)) || GENERIC;
  }
  return (error.code && MESSAGES_BY_CODE.get(error.code)) || GENERIC;
}
