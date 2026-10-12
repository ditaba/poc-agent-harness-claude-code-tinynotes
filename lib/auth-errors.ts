export type AuthError = {
  code?: string;
  message?: string;
  status?: number;
};

const INVALID_CREDENTIALS = "Invalid email or password.";
const EMAIL_TAKEN = "An account with this email already exists.";
const BAD_PASSWORD = "Password must be 8–128 characters.";
const BAD_EMAIL = "Enter a valid email address.";
const RATE_LIMITED = "Too many attempts. Please wait a minute and try again.";
const GENERIC = "Something went wrong. Please try again.";

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: INVALID_CREDENTIALS,
  USER_ALREADY_EXISTS: EMAIL_TAKEN,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: EMAIL_TAKEN,
  PASSWORD_TOO_SHORT: BAD_PASSWORD,
  PASSWORD_TOO_LONG: BAD_PASSWORD,
  INVALID_EMAIL: BAD_EMAIL,
};

// better-call joins schema issues as "[body.<field>] <msg>; …", so the first
// issue decides the message (§7).
function validationMessage(message = ""): string {
  if (message.startsWith("[body.email]")) return BAD_EMAIL;
  if (message.startsWith("[body.password]")) return BAD_PASSWORD;
  return GENERIC;
}

// Maps a better-auth client error to the §7 copy. A 429 from the rate limiter
// has no code (R10), so status is checked first.
export function authErrorMessage(error: AuthError | null): string {
  if (!error) return GENERIC;
  if (error.status === 429) return RATE_LIMITED;
  if (error.code === "VALIDATION_ERROR") {
    return validationMessage(error.message);
  }
  if (error.code && Object.hasOwn(MESSAGES, error.code)) {
    return MESSAGES[error.code];
  }
  return GENERIC;
}
