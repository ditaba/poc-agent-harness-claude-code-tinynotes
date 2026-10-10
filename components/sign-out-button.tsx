"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";

// Returns true when the session was revoked. authClient returns HTTP errors as `error`, but a network
// failure throws; both count as a failed sign-out.
async function signOut(): Promise<boolean> {
  try {
    const { error } = await authClient.signOut();
    if (error) {
      console.error(error);
    }
    return !error;
  } catch (cause) {
    console.error(cause);
    return false;
  }
}

export function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      // On failure the transition just ends: the button is enabled again and nothing else changes (D48).
      if (!(await signOut())) {
        return;
      }
      // Updates after an await need their own transition. The navigation runs inside it, so the button
      // stays disabled until /sign-in has loaded. refresh() drops router cache entries rendered signed in.
      startTransition(() => {
        router.push("/sign-in");
        router.refresh();
      });
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      Sign out
    </button>
  );
}
