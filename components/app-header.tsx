import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="border-b border-zinc-200">
      <div className="page-container flex items-center gap-4 py-3">
        <Link href="/notes" className="font-semibold">
          TinyNotes
        </Link>
        <span className="ml-auto min-w-0 truncate text-sm text-zinc-600">
          {email}
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}
