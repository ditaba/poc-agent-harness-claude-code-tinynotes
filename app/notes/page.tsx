import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { NewNoteButton } from "@/components/new-note-button";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format-date";
import { listNotes } from "@/lib/notes/repo";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your notes – TinyNotes" };

export default async function NotesPage() {
  // Signed-out users go to /sign-in (AUTH-12, D25).
  const user = await requireUser();
  // Only this user's notes, last edited first (NOTE-1, NOTE-3, D3).
  const notes = await listNotes(db, user.id);
  return (
    <>
      <AppHeader email={user.email} />
      <main className="page-container py-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Your notes</h1>
          <NewNoteButton />
        </div>
        {notes.length === 0 ? (
          <p className="mt-8 text-zinc-600">
            No notes yet. Create your first one.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-zinc-200 rounded-md border border-zinc-200">
            {notes.map((note) => (
              <li key={note.id}>
                <Link
                  href={`/notes/${note.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    {/* Titles are always React text, never HTML (§10). */}
                    <span className="truncate font-medium">
                      {note.title || "Untitled"}
                    </span>
                    <span className="text-sm text-zinc-600">
                      Updated{" "}
                      <time dateTime={new Date(note.updatedAt).toISOString()}>
                        {formatDateTime(note.updatedAt)}
                      </time>
                    </span>
                  </span>
                  {note.isShared && (
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      Shared
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
