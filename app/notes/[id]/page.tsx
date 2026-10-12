import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AppHeader } from "@/components/app-header";
import { NoteEditor } from "@/components/note-editor";
import { db } from "@/lib/db";
import { getNote } from "@/lib/notes/repo";
import { requireUser } from "@/lib/session";

// Shared by generateMetadata and the page, so the note is read once per request.
const loadOwnedNote = cache(async (id: string) => {
  const user = await requireUser();
  const note = getNote(db, user.id, id);
  // Missing and not-owned notes look the same (D24, NOTE-15).
  if (!note) notFound();
  return { user, note };
});

export async function generateMetadata({
  params,
}: PageProps<"/notes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const { note } = await loadOwnedNote(id);
  return { title: `${note.title || "Untitled"} – TinyNotes` };
}

export default async function NotePage({ params }: PageProps<"/notes/[id]">) {
  const { id } = await params;
  const { user, note } = await loadOwnedNote(id);

  return (
    <>
      <AppHeader email={user.email} />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link
          href="/notes"
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← All notes
        </Link>
        <NoteEditor
          note={{ id: note.id, title: note.title, content: note.content }}
        />
      </main>
    </>
  );
}
