"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

async function signOut(): Promise<boolean> {
  try {
    const { error } = await authClient.signOut();
    return !error;
  } catch {
    return false;
  }
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    if (await signOut()) {
      // Stay disabled while navigating away (AUTH-10).
      router.push("/sign-in");
      router.refresh();
      return;
    }
    // D48: re-enable with no message.
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded border border-zinc-300 px-3 py-1 text-sm font-medium disabled:opacity-60 dark:border-zinc-700"
    >
      Sign out
    </button>
  );
}
