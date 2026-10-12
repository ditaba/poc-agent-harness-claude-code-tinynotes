// D33: formatted on the server, in its local time zone unless one is given.
export function formatDateTime(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(ms);
}
