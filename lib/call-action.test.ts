import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { callAction } from "./call-action";
import type { ActionResult } from "./errors";

describe("callAction", () => {
  let consoleError: ReturnType<typeof spyOn<Console, "error">>;

  beforeEach(() => {
    consoleError = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test("a resolved { ok: true } result is returned unchanged", async () => {
    const result: ActionResult<{ updatedAt: number }> = {
      ok: true,
      data: { updatedAt: 1_760_111_100_000 },
    };
    expect(await callAction(async () => result)).toBe(result);
    expect(consoleError).not.toHaveBeenCalled();
  });

  test("a resolved { ok: false } result is returned unchanged, not turned into INTERNAL", async () => {
    const result: ActionResult = { ok: false, error: "NOT_FOUND" };
    expect(await callAction(async () => result)).toBe(result);
    expect(consoleError).not.toHaveBeenCalled();
  });

  test("a rejected call → console.error + { ok: false, error: INTERNAL } (D39)", async () => {
    const failure = new TypeError("Failed to fetch");
    expect(await callAction(() => Promise.reject(failure))).toEqual({
      ok: false,
      error: "INTERNAL",
    });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0]).toContain(failure);
  });

  test("a run() that throws before returning a promise → INTERNAL", async () => {
    const run = (): Promise<ActionResult> => {
      throw new Error("boom");
    };
    expect(await callAction(run)).toEqual({ ok: false, error: "INTERNAL" });
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
