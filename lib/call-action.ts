import type { ActionResult } from "./errors";

// Client components wrap every note action call in this. A call that rejects (network failure, server restart,
// request over Next's 1 MB body limit, stale action after a rebuild) becomes INTERNAL, so the pending state ends
// (D39). The wrapped actions never redirect (D41), so there is nothing to rethrow.
export async function callAction<T>(
  run: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (error) {
    console.error("Action call failed:", error);
    return { ok: false, error: "INTERNAL" };
  }
}
