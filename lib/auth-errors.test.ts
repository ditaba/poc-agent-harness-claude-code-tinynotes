import { describe, expect, test } from "bun:test";
import { BASE_ERROR_CODES } from "better-auth";
import { authErrorMessage } from "./auth-errors";

const GENERIC = "Something went wrong. Please try again.";

// The §7 auth table, with the status better-auth 1.7.7 sends alongside each code.
const codeRows = [
  ["INVALID_EMAIL_OR_PASSWORD", 401, "Invalid email or password."],
  ["USER_ALREADY_EXISTS", 422, "An account with this email already exists."],
  [
    "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
    422,
    "An account with this email already exists.",
  ],
  ["PASSWORD_TOO_SHORT", 400, "Password must be 8–128 characters."],
  ["PASSWORD_TOO_LONG", 400, "Password must be 8–128 characters."],
  ["INVALID_EMAIL", 400, "Enter a valid email address."],
] as const;

describe("authErrorMessage", () => {
  test.each(codeRows)("%s → its §7 copy", (code, status, message) => {
    expect(authErrorMessage({ code, status })).toBe(message);
  });

  test("every mapped code exists in better-auth's BASE_ERROR_CODES", () => {
    expect(BASE_ERROR_CODES).toHaveProperty("VALIDATION_ERROR");
    for (const [code] of codeRows) {
      expect(BASE_ERROR_CODES).toHaveProperty(code);
    }
  });

  // Sign-up's body schema sends these instead of INVALID_EMAIL / PASSWORD_TOO_SHORT (messages as 1.7.7 sends them).
  test("sign-up VALIDATION_ERROR on body.email → the INVALID_EMAIL copy", () => {
    expect(
      authErrorMessage({
        code: "VALIDATION_ERROR",
        message: "[body.email] Invalid email address",
        status: 400,
      }),
    ).toBe("Enter a valid email address.");
  });

  test("sign-up VALIDATION_ERROR on body.password (empty) → the password-length copy", () => {
    expect(
      authErrorMessage({
        code: "VALIDATION_ERROR",
        message:
          "[body.password] Too small: expected string to have >=1 characters",
        status: 400,
      }),
    ).toBe("Password must be 8–128 characters.");
  });

  test("VALIDATION_ERROR on another field or with no message → generic message", () => {
    expect(
      authErrorMessage({
        code: "VALIDATION_ERROR",
        message: "[body.name] Invalid input",
        status: 400,
      }),
    ).toBe(GENERIC);
    expect(authErrorMessage({ code: "VALIDATION_ERROR", status: 400 })).toBe(
      GENERIC,
    );
  });

  test("status 429 with no code (the rate limiter's response) → too many attempts", () => {
    expect(authErrorMessage({ status: 429 })).toBe(
      "Too many attempts. Please wait a minute and try again.",
    );
  });

  test("null (network failure) → generic message", () => {
    expect(authErrorMessage(null)).toBe(GENERIC);
  });

  test("an unknown code → generic message", () => {
    expect(
      authErrorMessage({ code: "FAILED_TO_CREATE_USER", status: 422 }),
    ).toBe(GENERIC);
  });

  test("no code and a non-429 status → generic message", () => {
    expect(authErrorMessage({ status: 500 })).toBe(GENERIC);
    expect(authErrorMessage({})).toBe(GENERIC);
  });

  test("a code named like an Object.prototype key → generic message", () => {
    expect(authErrorMessage({ code: "toString", status: 400 })).toBe(GENERIC);
    expect(authErrorMessage({ code: "__proto__", status: 400 })).toBe(GENERIC);
  });
});
