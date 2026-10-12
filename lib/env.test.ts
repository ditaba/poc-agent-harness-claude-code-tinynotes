import { describe, expect, test } from "bun:test";
import { checkEnv, databaseUrl } from "./env";

const valid = {
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  TURSO_DATABASE_URL: "file:data/app.db",
};

const turso = {
  ...valid,
  TURSO_DATABASE_URL: "libsql://tinynotes-acme.aws-eu-west-1.turso.io",
  TURSO_AUTH_TOKEN: "token",
};

function expectOneProblem(
  env: Record<string, string | undefined>,
  name: string,
) {
  const problems = checkEnv(env);
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain(name);
  expect(problems[0]).toContain(".env.example");
}

describe("checkEnv", () => {
  test("valid env → []", () => {
    expect(checkEnv(valid)).toEqual([]);
  });

  test("TURSO_DATABASE_URL is optional locally", () => {
    expect(checkEnv({ ...valid, TURSO_DATABASE_URL: undefined })).toEqual([]);
  });

  test("missing BETTER_AUTH_SECRET → one message naming it", () => {
    expectOneProblem(
      { ...valid, BETTER_AUTH_SECRET: undefined },
      "BETTER_AUTH_SECRET",
    );
  });

  test("31-char BETTER_AUTH_SECRET → one message naming it", () => {
    expectOneProblem(
      { ...valid, BETTER_AUTH_SECRET: "a".repeat(31) },
      "BETTER_AUTH_SECRET",
    );
  });

  test("missing BETTER_AUTH_URL → one message naming it", () => {
    expectOneProblem(
      { ...valid, BETTER_AUTH_URL: undefined },
      "BETTER_AUTH_URL",
    );
  });

  test("Turso URL with its token → []", () => {
    expect(checkEnv(turso)).toEqual([]);
  });

  test("Turso URL without TURSO_AUTH_TOKEN → one message naming it", () => {
    expectOneProblem(
      { ...turso, TURSO_AUTH_TOKEN: undefined },
      "TURSO_AUTH_TOKEN",
    );
  });

  test("on Vercel, a file: or missing database URL → one message naming TURSO_DATABASE_URL", () => {
    expectOneProblem({ ...valid, VERCEL: "1" }, "TURSO_DATABASE_URL");
    expectOneProblem(
      { ...valid, TURSO_DATABASE_URL: undefined, VERCEL: "1" },
      "TURSO_DATABASE_URL",
    );
  });

  test("on Vercel, a Turso URL with its token → []", () => {
    expect(checkEnv({ ...turso, VERCEL: "1" })).toEqual([]);
  });
});

describe("databaseUrl", () => {
  test("defaults to the local file data/app.db, also for an empty value", () => {
    expect(databaseUrl({})).toBe("file:data/app.db");
    expect(databaseUrl({ TURSO_DATABASE_URL: "" })).toBe("file:data/app.db");
  });

  test("returns TURSO_DATABASE_URL when set", () => {
    expect(databaseUrl(turso)).toBe(turso.TURSO_DATABASE_URL);
  });
});
