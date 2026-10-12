import { describe, expect, test } from "bun:test";
import { checkEnv, databaseUrl } from "./env";

const validEnv = {
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  TURSO_DATABASE_URL: "file:data/app.db",
};

const tursoEnv = {
  ...validEnv,
  TURSO_DATABASE_URL: "libsql://tinynotes-acme.aws-eu-west-1.turso.io",
  TURSO_AUTH_TOKEN: "token",
};

function expectOneMessageNaming(problems: string[], variable: string) {
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain(variable);
  expect(problems[0]).toContain(".env.example");
}

describe("checkEnv", () => {
  test("a valid env → []", () => {
    expect(checkEnv(validEnv)).toEqual([]);
  });

  test("TURSO_DATABASE_URL is optional", () => {
    expect(checkEnv({ ...validEnv, TURSO_DATABASE_URL: undefined })).toEqual(
      [],
    );
  });

  test("missing BETTER_AUTH_SECRET → one message naming it", () => {
    expectOneMessageNaming(
      checkEnv({ ...validEnv, BETTER_AUTH_SECRET: undefined }),
      "BETTER_AUTH_SECRET",
    );
  });

  test("an empty BETTER_AUTH_SECRET counts as missing", () => {
    expectOneMessageNaming(
      checkEnv({ ...validEnv, BETTER_AUTH_SECRET: "" }),
      "BETTER_AUTH_SECRET",
    );
  });

  test("a 31-char BETTER_AUTH_SECRET → one message naming it", () => {
    expectOneMessageNaming(
      checkEnv({ ...validEnv, BETTER_AUTH_SECRET: "a".repeat(31) }),
      "BETTER_AUTH_SECRET",
    );
  });

  test("missing BETTER_AUTH_URL → one message naming it", () => {
    expectOneMessageNaming(
      checkEnv({ ...validEnv, BETTER_AUTH_URL: undefined }),
      "BETTER_AUTH_URL",
    );
  });

  test("several problems → one message each", () => {
    expect(checkEnv({})).toHaveLength(2);
  });

  test("a Turso URL with its token → []", () => {
    expect(checkEnv(tursoEnv)).toEqual([]);
  });

  test("a Turso URL without TURSO_AUTH_TOKEN → one message naming it", () => {
    expectOneMessageNaming(
      checkEnv({ ...tursoEnv, TURSO_AUTH_TOKEN: undefined }),
      "TURSO_AUTH_TOKEN",
    );
  });

  test("on Vercel, a file: database → one message naming TURSO_DATABASE_URL", () => {
    expectOneMessageNaming(
      checkEnv({ ...validEnv, VERCEL: "1" }),
      "TURSO_DATABASE_URL",
    );
  });

  test("on Vercel, no TURSO_DATABASE_URL → one message naming it", () => {
    expectOneMessageNaming(
      checkEnv({ ...validEnv, TURSO_DATABASE_URL: undefined, VERCEL: "1" }),
      "TURSO_DATABASE_URL",
    );
  });

  test("on Vercel, a Turso URL with its token → []", () => {
    expect(checkEnv({ ...tursoEnv, VERCEL: "1" })).toEqual([]);
  });
});

describe("databaseUrl", () => {
  test("defaults to the local file data/app.db", () => {
    expect(databaseUrl({})).toBe("file:data/app.db");
  });

  test("an empty TURSO_DATABASE_URL counts as missing", () => {
    expect(databaseUrl({ TURSO_DATABASE_URL: "" })).toBe("file:data/app.db");
  });

  test("returns TURSO_DATABASE_URL when set", () => {
    expect(databaseUrl(tursoEnv)).toBe(tursoEnv.TURSO_DATABASE_URL);
  });
});
