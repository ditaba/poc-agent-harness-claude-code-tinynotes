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
  const user = await requireUser();
  const notes = listNotes(db, user.id);

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
          <ul className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200">
            {notes.map((note) => (
              <li key={note.id}>
                <Link
                  href={`/notes/${note.id}`}
                  className="flex items-center gap-3 px-2 py-3 hover:bg-zinc-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {note.title || "Untitled"}
                    </span>
                    <span className="block text-sm text-zinc-600">
                      Updated {formatDateTime(note.updatedAt)}
                    </span>
                  </span>
                  {note.isShared && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
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
