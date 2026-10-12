import { afterEach, describe, expect, test } from "bun:test";
import {
  buildShareUrl,
  generateShareToken,
  isShareTokenFormat,
  SHARE_TOKEN_PATTERN,
} from "./share-token";

const valid = "a".repeat(32);

describe("generateShareToken", () => {
  test("is 32 chars and matches SHARE_TOKEN_PATTERN", () => {
    const token = generateShareToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(SHARE_TOKEN_PATTERN);
  });

  test("1 000 tokens are unique", () => {
    const tokens = new Set(
      Array.from({ length: 1000 }, () => generateShareToken()),
    );
    expect(tokens.size).toBe(1000);
  });
});

describe("isShareTokenFormat", () => {
  test("accepts 32 base64url chars", () => {
    expect(isShareTokenFormat(valid)).toBe(true);
    expect(isShareTokenFormat("Az09_-".padEnd(32, "x"))).toBe(true);
  });

  test("rejects 31 and 33 chars", () => {
    expect(isShareTokenFormat("a".repeat(31))).toBe(false);
    expect(isShareTokenFormat("a".repeat(33))).toBe(false);
  });

  test.each(["+", "/", "="])("rejects %s", (char) => {
    expect(isShareTokenFormat(char + "a".repeat(31))).toBe(false);
  });
});

describe("buildShareUrl", () => {
  const originalUrl = process.env.BETTER_AUTH_URL;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = originalUrl;
  });

  test("joins base URL and /s/{token}", () => {
    expect(buildShareUrl(valid, "http://x")).toBe(`http://x/s/${valid}`);
  });

  test("defaults the base to BETTER_AUTH_URL", () => {
    process.env.BETTER_AUTH_URL = "http://default.test";
    expect(buildShareUrl(valid)).toBe(`http://default.test/s/${valid}`);
  });
});
