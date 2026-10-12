import { describe, expect, test } from "bun:test";
import { formatDateTime } from "./format-date";

describe("formatDateTime", () => {
  test("medium date + short time in the given zone (D33)", () => {
    expect(formatDateTime(Date.UTC(2026, 9, 10, 15, 45), "UTC")).toBe(
      "Oct 10, 2026, 3:45 PM",
    );
  });
});
