import { afterEach, describe, expect, test } from "bun:test";
import { formatDateTime } from "./format-date";

const OCT_10_2026_1545_UTC = Date.UTC(2026, 9, 10, 15, 45);

describe("formatDateTime", () => {
  // Exact string: plain spaces only (newer ICU builds put U+202F before "PM"; Bun's doesn't).
  test('Date.UTC(2026, 9, 10, 15, 45) in "UTC" → "Oct 10, 2026, 3:45 PM" (D33)', () => {
    expect(formatDateTime(OCT_10_2026_1545_UTC, "UTC")).toBe(
      "Oct 10, 2026, 3:45 PM",
    );
  });

  test("midnight and noon use the 12-hour clock", () => {
    expect(formatDateTime(Date.UTC(2026, 0, 1, 0, 5), "UTC")).toBe(
      "Jan 1, 2026, 12:05 AM",
    );
    expect(formatDateTime(Date.UTC(2026, 0, 1, 12, 5), "UTC")).toBe(
      "Jan 1, 2026, 12:05 PM",
    );
  });

  describe("time zone", () => {
    // bun test runs in UTC. Setting process.env.TZ changes the default zone at runtime, and deleting it doesn't
    // change it back, so the original zone is set again before the variable is removed.
    const originalTz = process.env.TZ;
    const originalZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    afterEach(() => {
      process.env.TZ = originalZone;
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    });

    test("with no timeZone, the server's local time zone is used (D33)", () => {
      process.env.TZ = "America/New_York";
      expect(formatDateTime(OCT_10_2026_1545_UTC)).toBe(
        "Oct 10, 2026, 11:45 AM",
      );
    });

    test("a given timeZone wins over the local one", () => {
      process.env.TZ = "America/New_York";
      expect(formatDateTime(OCT_10_2026_1545_UTC, "Asia/Tokyo")).toBe(
        "Oct 11, 2026, 12:45 AM",
      );
    });
  });
});
