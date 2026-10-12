import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your notes – TinyNotes" };

// M3 stub; the list and "New note" come in M4.
export default async function NotesPage() {
  const user = await requireUser();
  return (
    <>
      <AppHeader email={user.email} />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Your notes</h1>
      </main>
    </>
  );
}
