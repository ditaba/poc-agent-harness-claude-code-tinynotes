"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../db";
import { getCurrentUser } from "../session";
import { createNote } from "./repo";

// Server Actions are public endpoints, so each one checks the session itself (D25, §10).

// The only form action (NewNoteButton) and the only action that redirects (D41). It has no try/catch, so
// redirect() works and an unexpected error reaches app/error.tsx (§7).
export async function createNoteAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  const note = createNote(db, user.id); // title "", EMPTY_DOC (NOTE-4)
  // Purges the client router cache, so a cached /notes without the new note is never shown (NOTE-4).
  revalidatePath("/notes");
  redirect(`/notes/${note.id}`);
}
