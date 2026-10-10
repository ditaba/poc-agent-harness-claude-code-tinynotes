// Share links are /s/{token}: 24 random bytes as base64url (32 chars, no padding), separate from the note id (D5).
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

const SHARE_TOKEN_BYTES = 24;

export function generateShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHARE_TOKEN_BYTES));
  return Buffer.from(bytes).toString("base64url");
}

// /s/[token] checks this before querying, so malformed tokens never reach the DB (PUB-2).
export function isShareTokenFormat(value: string): boolean {
  return SHARE_TOKEN_PATTERN.test(value);
}

// new URL() tolerates a trailing slash on the base and throws instead of building "undefined/s/…".
export function buildShareUrl(
  token: string,
  baseUrl = process.env.BETTER_AUTH_URL,
): string {
  return new URL(`/s/${token}`, baseUrl).href;
}
