import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

// Shared header of the signed-in pages (§5). The page passes the email from requireUser(), so the header
// never decides on its own whether someone is signed in (D25).
export function AppHeader({ email }: { email: string }) {
  return (
    <header className="border-b border-zinc-200">
      <div className="page-container flex items-center justify-between gap-4 py-3">
        <Link href="/notes" className="shrink-0 text-lg font-semibold">
          TinyNotes
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-sm text-zinc-600">{email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
