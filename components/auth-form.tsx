"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, type AuthError } from "@/lib/auth-errors";
import { MessageRegion, type Message } from "./message-region";

const COPY = {
  "sign-up": {
    heading: "Create your account",
    submit: "Create account",
    pending: "Creating account…",
    altText: "Already have an account?",
    altLink: "Sign in",
    altHref: "/sign-in",
  },
  "sign-in": {
    heading: "Sign in to TinyNotes",
    submit: "Sign in",
    pending: "Signing in…",
    altText: "No account yet?",
    altLink: "Create one",
    altHref: "/sign-up",
  },
} as const;

type Mode = keyof typeof COPY;

type SubmitResult = { ok: true } | { ok: false; error: AuthError | null };

async function submitAuth(
  mode: Mode,
  email: string,
  password: string,
): Promise<SubmitResult> {
  try {
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: email })
        : await authClient.signIn.email({ email, password });
    return error ? { ok: false, error } : { ok: true };
  } catch {
    // Network failure: a null error maps to the generic copy (AUTH-14).
    return { ok: false, error: null };
  }
}

export function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const router = useRouter();
  const id = useId();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    // MSG-2: starting a submit clears the region.
    setMessage(null);
    setPending(true);
    const result = await submitAuth(mode, email, password);
    if (result.ok) {
      // Stay pending while navigating so the form can't be resubmitted (D30).
      router.push("/notes");
      router.refresh();
      return;
    }
    // D47: keep the email, clear the password.
    if (passwordRef.current) passwordRef.current.value = "";
    setMessage({ kind: "error", text: authErrorMessage(result.error) });
    setPending(false);
  }

  const emailId = `${id}-email`;
  const passwordId = `${id}-password`;
  const hintId = `${id}-password-hint`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">{copy.heading}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={emailId} className="text-sm font-medium">
            Email
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={passwordId} className="text-sm font-medium">
            Password
          </label>
          <input
            ref={passwordRef}
            id={passwordId}
            name="password"
            type="password"
            autoComplete={
              mode === "sign-up" ? "new-password" : "current-password"
            }
            required
            {...(mode === "sign-up" && {
              minLength: 8,
              maxLength: 128,
              "aria-describedby": hintId,
            })}
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700"
          />
          {mode === "sign-up" && (
            <p id={hintId} className="text-sm text-zinc-600 dark:text-zinc-400">
              At least 8 characters.
            </p>
          )}
        </div>
        <MessageRegion message={message} />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? copy.pending : copy.submit}
        </button>
      </form>
      <p className="text-sm">
        {copy.altText}{" "}
        <Link href={copy.altHref} className="font-medium underline">
          {copy.altLink}
        </Link>
      </p>
    </main>
  );
}
