import { describe, expect, test } from "bun:test";
import { checkEnv } from "./env";

const validEnv = {
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  DB_PATH: "data/app.db",
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

  test("DB_PATH is optional", () => {
    expect(checkEnv({ ...validEnv, DB_PATH: undefined })).toEqual([]);
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
});
