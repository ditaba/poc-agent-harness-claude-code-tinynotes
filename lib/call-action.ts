import type { ActionResult } from "@/lib/errors";

// A rejected action call (network failure, server restart, request over the
// 1 MB limit, stale action after a rebuild) becomes INTERNAL (D39). The wrapped
// actions never redirect (D41), so there is nothing to rethrow.
export async function callAction<T>(
  run: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (error) {
    console.error(error);
    return { ok: false, error: "INTERNAL" };
  }
}
