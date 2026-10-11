import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AppHeader } from "@/components/app-header";
import { NoteEditor } from "@/components/note-editor";
import { SharePanel } from "@/components/share-panel";
import { db } from "@/lib/db";
import { getNote } from "@/lib/notes/repo";
import { requireUser } from "@/lib/session";
import { buildShareUrl } from "@/lib/share-token";

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
      <main className="page-container py-8">
        <Link
          href="/notes"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:underline"
        >
          ← All notes
        </Link>
        <div className="mt-6">
          {/* The editor gets its content; sharing gets only its URL. */}
          <NoteEditor
            note={{ id: note.id, title: note.title, content: note.content }}
          />
        </div>
        <SharePanel
          key={note.id}
          noteId={note.id}
          initialShareUrl={
            note.shareToken ? buildShareUrl(note.shareToken) : null
          }
        />
      </main>
    </>
  );
}
