// Formatted on the server, in its local time zone unless one is given, e.g. "Oct 10, 2026, 3:45 PM" (D33).
export function formatDateTime(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(ms);
}
