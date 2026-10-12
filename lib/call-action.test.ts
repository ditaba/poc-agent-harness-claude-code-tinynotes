import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { callAction } from "./call-action";
import type { ActionResult } from "./errors";

describe("callAction", () => {
  const consoleError = spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    consoleError.mockClear();
  });

  test("resolved { ok: true } is returned unchanged", async () => {
    const result: ActionResult<{ id: string }> = {
      ok: true,
      data: { id: "n1" },
    };
    expect(await callAction(async () => result)).toBe(result);
    expect(consoleError).not.toHaveBeenCalled();
  });

  test("resolved { ok: false } is returned unchanged", async () => {
    const result: ActionResult = { ok: false, error: "NOT_FOUND" };
    expect(await callAction(async () => result)).toBe(result);
    expect(consoleError).not.toHaveBeenCalled();
  });

  test("rejected call → console.error + INTERNAL (D39)", async () => {
    const failure = new TypeError("Failed to fetch");
    const result = await callAction<undefined>(() => Promise.reject(failure));
    expect(result).toEqual({ ok: false, error: "INTERNAL" });
    expect(consoleError).toHaveBeenCalledWith(failure);
  });
});
