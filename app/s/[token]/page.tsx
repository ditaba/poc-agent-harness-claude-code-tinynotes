import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { NoteContent } from "@/components/note-content";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format-date";
import { getSharedNote } from "@/lib/notes/repo";
import { isShareTokenFormat } from "@/lib/share-token";

// Public page: no session lookup. Malformed tokens never reach the DB (PUB-2).
const loadSharedNote = cache(async (token: string) => {
  const note = isShareTokenFormat(token) ? getSharedNote(db, token) : null;
  if (!note) notFound();
  return note;
});

export async function generateMetadata({
  params,
}: PageProps<"/s/[token]">): Promise<Metadata> {
  const { token } = await params;
  const note = await loadSharedNote(token);
  return {
    title: `${note.title || "Untitled"} – TinyNotes`,
    robots: { index: false, follow: false },
  };
}

// Title, "Last updated" and content only, no author info (PUB-1, D8).
export default async function SharedNotePage({
  params,
}: PageProps<"/s/[token]">) {
  const { token } = await params;
  const note = await loadSharedNote(token);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <article>
        <h1 className="text-3xl font-semibold">{note.title || "Untitled"}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Last updated {formatDateTime(note.updatedAt)}
        </p>
        <div className="mt-6">
          <NoteContent content={note.content} />
        </div>
      </article>
      <footer className="mt-12 border-t border-zinc-200 pt-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        Shared with TinyNotes
      </footer>
    </main>
  );
}
