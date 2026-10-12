export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

const TOKEN_BYTES = 24;

// 24 random bytes → 32-char base64url (D5).
export function generateShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Buffer.from(bytes).toString("base64url");
}

export function isShareTokenFormat(value: string): boolean {
  return SHARE_TOKEN_PATTERN.test(value);
}

export function buildShareUrl(
  token: string,
  baseUrl = process.env.BETTER_AUTH_URL ?? "",
): string {
  return `${baseUrl}/s/${token}`;
}
