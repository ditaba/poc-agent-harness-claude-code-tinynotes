import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AppHeader } from "@/components/app-header";
import { NoteEditor } from "@/components/note-editor";
import { db } from "@/lib/db";
import { getNote } from "@/lib/notes/repo";
import { requireUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

// Shared by generateMetadata and the page, so each request looks the note up once. Signed-out users go to
// /sign-in (AUTH-12, D25). A missing note and another user's note both give the generic 404 (NOTE-15, D24).
const loadNote = cache(async (id: string) => {
  const user = await requireUser();
  const note = getNote(db, user.id, id);
  if (!note) {
    notFound();
  }
  return { user, note };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { note } = await loadNote((await params).id);
  return { title: `${note.title || "Untitled"} – TinyNotes` };
}

// The owner's editor; there is no separate read-only view (D15).
export default async function NotePage({ params }: Props) {
  const { user, note } = await loadNote((await params).id);
  return (
    <>
      <AppHeader email={user.email} />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link
          href="/notes"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:underline"
        >
          ← All notes
        </Link>
        <div className="mt-6">
          {/* Only what the editor needs; the share token stays on the server. */}
          <NoteEditor
            note={{ id: note.id, title: note.title, content: note.content }}
          />
        </div>
      </main>
    </>
  );
}
