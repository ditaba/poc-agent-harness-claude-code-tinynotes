import { afterEach, describe, expect, test } from "bun:test";
import {
  buildShareUrl,
  generateShareToken,
  isShareTokenFormat,
  SHARE_TOKEN_PATTERN,
} from "./share-token";

const VALID_TOKEN = "abcDEF0123456789_-abcDEF01234567";

describe("generateShareToken", () => {
  test("returns 32 chars matching SHARE_TOKEN_PATTERN", () => {
    const token = generateShareToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(SHARE_TOKEN_PATTERN);
  });

  test("encodes 24 random bytes as base64url (D5)", () => {
    expect(Buffer.from(generateShareToken(), "base64url")).toHaveLength(24);
  });

  test("1 000 tokens are unique and all match SHARE_TOKEN_PATTERN", () => {
    const tokens = Array.from({ length: 1000 }, () => generateShareToken());
    expect(new Set(tokens).size).toBe(1000);
    expect(tokens.filter((token) => !SHARE_TOKEN_PATTERN.test(token))).toEqual(
      [],
    );
  });
});

describe("isShareTokenFormat", () => {
  test("accepts 32 base64url chars, including - and _", () => {
    expect(VALID_TOKEN).toHaveLength(32);
    expect(isShareTokenFormat(VALID_TOKEN)).toBe(true);
  });

  test("accepts generated tokens", () => {
    expect(isShareTokenFormat(generateShareToken())).toBe(true);
  });

  test("rejects 31 and 33 chars", () => {
    expect(isShareTokenFormat(VALID_TOKEN.slice(1))).toBe(false);
    expect(isShareTokenFormat(`${VALID_TOKEN}a`)).toBe(false);
  });

  test.each(["+", "/", "="])("rejects %s", (char) => {
    expect(isShareTokenFormat(`${VALID_TOKEN.slice(1)}${char}`)).toBe(false);
  });

  test("rejects the empty string and surrounding whitespace", () => {
    expect(isShareTokenFormat("")).toBe(false);
    expect(isShareTokenFormat(` ${VALID_TOKEN.slice(1)}`)).toBe(false);
    expect(isShareTokenFormat(`${VALID_TOKEN.slice(1)}\n`)).toBe(false);
  });
});

describe("buildShareUrl", () => {
  const originalBaseUrl = process.env.BETTER_AUTH_URL;

  afterEach(() => {
    if (originalBaseUrl === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = originalBaseUrl;
  });

  test("appends /s/{token} to the given base", () => {
    expect(buildShareUrl(VALID_TOKEN, "http://x")).toBe(
      `http://x/s/${VALID_TOKEN}`,
    );
  });

  test("a trailing slash on the base gives no double slash", () => {
    expect(buildShareUrl(VALID_TOKEN, "http://x/")).toBe(
      `http://x/s/${VALID_TOKEN}`,
    );
  });

  test("defaults the base to process.env.BETTER_AUTH_URL", () => {
    process.env.BETTER_AUTH_URL = "https://notes.example.com";
    expect(buildShareUrl(VALID_TOKEN)).toBe(
      `https://notes.example.com/s/${VALID_TOKEN}`,
    );
  });
});
