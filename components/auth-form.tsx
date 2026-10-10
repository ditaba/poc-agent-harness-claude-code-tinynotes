"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { MessageRegion, type Message } from "./message-region";

type Mode = "sign-in" | "sign-up";

// better-auth's default password length (D10).
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const COPY = {
  "sign-up": {
    heading: "Create your account",
    submit: "Create account",
    pending: "Creating account…",
    prompt: "Already have an account?",
    link: { label: "Sign in", href: "/sign-in" },
  },
  "sign-in": {
    heading: "Sign in to TinyNotes",
    submit: "Sign in",
    pending: "Signing in…",
    prompt: "No account yet?",
    link: { label: "Create one", href: "/sign-up" },
  },
} as const;

// Returns the §7 message on failure, null on success. authClient returns HTTP errors as `error`,
// but a network failure throws, which maps to the generic message (AUTH-14).
async function authenticate(
  mode: Mode,
  email: string,
  password: string,
): Promise<string | null> {
  try {
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: email }) // name = email (D9)
        : await authClient.signIn.email({ email, password });
    return error ? authErrorMessage(error) : null;
  } catch (cause) {
    console.error(cause);
    return authErrorMessage(null);
  }
}

export function AuthForm({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const isSignUp = mode === "sign-up";
  const router = useRouter();
  const hintId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<Message | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null); // starting a submit clears the region (MSG-2)
    startTransition(async () => {
      const error = await authenticate(mode, email, password);
      // Updates after an await need their own transition. The navigation runs inside it, so the
      // button stays pending until /notes has loaded.
      startTransition(() => {
        if (error) {
          // The error stays until the next submit, even while typing (MSG-2). Keep the email (D47).
          setMessage({ type: "error", content: error });
          setPassword("");
          return;
        }
        // Always /notes, no return URL (D30). refresh() drops router cache entries rendered signed out.
        router.push("/notes");
        router.refresh();
      });
    });
  }

  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold">{copy.heading}</h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal"
          />
        </label>
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Password
            <input
              type="password"
              name="password"
              required
              minLength={isSignUp ? PASSWORD_MIN_LENGTH : undefined}
              maxLength={isSignUp ? PASSWORD_MAX_LENGTH : undefined}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              aria-describedby={isSignUp ? hintId : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-base font-normal"
            />
          </label>
          {isSignUp && (
            <p id={hintId} className="text-sm text-zinc-600">
              At least 8 characters.
            </p>
          )}
        </div>
        <MessageRegion message={message} />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? copy.pending : copy.submit}
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-600">
        {copy.prompt}{" "}
        <Link
          href={copy.link.href}
          className="font-medium text-zinc-900 underline"
        >
          {copy.link.label}
        </Link>
      </p>
    </div>
  );
}
