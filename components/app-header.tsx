import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 py-3">
        <Link href="/notes" className="font-semibold">
          TinyNotes
        </Link>
        <span className="ml-auto truncate text-sm text-zinc-600 dark:text-zinc-400">
          {email}
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}
