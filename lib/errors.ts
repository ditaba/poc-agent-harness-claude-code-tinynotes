// Note actions return an ActionResult and never throw to the client, which only ever sees an ErrorCode and shows
// its ERROR_MESSAGES copy (§7). No imports, so client components can use it too.
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "TITLE_TOO_LONG"
  | "CONTENT_TOO_LARGE"
  | "INVALID_CONTENT"
  | "INTERNAL";

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: ErrorCode };

// The editor puts its "Sign in" link (new tab) after the UNAUTHENTICATED copy (§7).
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Your session has expired. Sign in again to continue.",
  NOT_FOUND: "This note no longer exists.",
  TITLE_TOO_LONG: "Title must be 200 characters or fewer.",
  CONTENT_TOO_LARGE: "This note is too large to save (max 100 KB).",
  INVALID_CONTENT:
    "This note contains unsupported content and couldn't be saved.",
  INTERNAL: "Something went wrong. Please try again.",
};
