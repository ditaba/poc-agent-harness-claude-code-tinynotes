import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { NoteContent } from "@/components/note-content";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format-date";
import { getSharedNote } from "@/lib/notes/repo";
import { isShareTokenFormat } from "@/lib/share-token";

type Props = { params: Promise<{ token: string }> };

// Request-local memoization shares the lookup with metadata, without caching revoked links.
const loadSharedNote = cache(async (token: string) => {
  if (!isShareTokenFormat(token)) {
    notFound();
  }
  // The synchronous SQLite query must read the latest saved state at request time (D7).
  await connection();
  const note = getSharedNote(db, token);
  if (!note) {
    notFound();
  }
  return note;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const note = await loadSharedNote((await params).token);
  return {
    title: `${note.title || "Untitled"} – TinyNotes`,
    robots: { index: false, follow: false },
  };
}

export default async function SharedNotePage({ params }: Props) {
  const note = await loadSharedNote((await params).token);
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <article>
        <h1 className="text-2xl font-semibold">{note.title || "Untitled"}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Last updated {formatDateTime(note.updatedAt)}
        </p>
        <div className="mt-6">
          <NoteContent content={note.content} />
        </div>
      </article>
      <footer className="mt-8 border-t border-zinc-200 pt-4 text-sm text-zinc-600">
        Shared with TinyNotes
      </footer>
    </main>
  );
}
