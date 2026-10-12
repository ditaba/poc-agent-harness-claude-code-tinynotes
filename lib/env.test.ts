import { describe, expect, test } from "bun:test";
import { checkEnv } from "./env";

const valid = {
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  DB_PATH: "data/app.db",
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
});
