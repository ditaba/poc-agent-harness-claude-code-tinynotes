import { describe, expect, test } from "bun:test";
import { authErrorMessage } from "./auth-errors";

const INVALID_CREDENTIALS = "Invalid email or password.";
const EMAIL_TAKEN = "An account with this email already exists.";
const BAD_PASSWORD = "Password must be 8–128 characters.";
const BAD_EMAIL = "Enter a valid email address.";
const RATE_LIMITED = "Too many attempts. Please wait a minute and try again.";
const GENERIC = "Something went wrong. Please try again.";

describe("authErrorMessage", () => {
  test.each([
    ["INVALID_EMAIL_OR_PASSWORD", INVALID_CREDENTIALS],
    ["USER_ALREADY_EXISTS", EMAIL_TAKEN],
    ["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", EMAIL_TAKEN],
    ["PASSWORD_TOO_SHORT", BAD_PASSWORD],
    ["PASSWORD_TOO_LONG", BAD_PASSWORD],
    ["INVALID_EMAIL", BAD_EMAIL],
  ])("%s → §7 copy", (code, expected) => {
    expect(authErrorMessage({ code, status: 400 })).toBe(expected);
  });

  test("VALIDATION_ERROR on body.password → password copy (AUTH-4)", () => {
    expect(
      authErrorMessage({
        code: "VALIDATION_ERROR",
        message:
          "[body.password] Too small: expected string to have >=1 characters",
        status: 400,
      }),
    ).toBe(BAD_PASSWORD);
  });

  test("VALIDATION_ERROR on body.email → email copy (AUTH-5)", () => {
    expect(
      authErrorMessage({
        code: "VALIDATION_ERROR",
        message: "[body.email] Invalid email address",
        status: 400,
      }),
    ).toBe(BAD_EMAIL);
  });

  test("VALIDATION_ERROR with several issues uses the first", () => {
    expect(
      authErrorMessage({
        code: "VALIDATION_ERROR",
        message:
          "[body.email] Invalid email address; [body.password] Too small",
      }),
    ).toBe(BAD_EMAIL);
  });

  test("VALIDATION_ERROR on another field → generic", () => {
    expect(
      authErrorMessage({
        code: "VALIDATION_ERROR",
        message: "[body.name] Required",
      }),
    ).toBe(GENERIC);
    expect(authErrorMessage({ code: "VALIDATION_ERROR" })).toBe(GENERIC);
  });

  test("status 429 → rate-limit copy (AUTH-14)", () => {
    expect(
      authErrorMessage({
        status: 429,
        message: "Too many requests. Please try again later.",
      }),
    ).toBe(RATE_LIMITED);
    expect(authErrorMessage({ status: 429, code: "INVALID_EMAIL" })).toBe(
      RATE_LIMITED,
    );
  });

  test("null → generic (AUTH-14)", () => {
    expect(authErrorMessage(null)).toBe(GENERIC);
  });

  test.each([
    [{ code: "SOMETHING_NEW", status: 400 }],
    [{ status: 500 }],
    [{}],
    [{ code: "toString" }],
  ])("unknown error %p → generic (AUTH-14)", (error) => {
    expect(authErrorMessage(error)).toBe(GENERIC);
  });
});
