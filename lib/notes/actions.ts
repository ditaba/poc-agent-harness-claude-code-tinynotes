"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { createNote } from "./repo";

// The only form action (D17). No try/catch: redirect() works by throwing, and an
// unexpected error reaches app/error.tsx (§7).
export async function createNoteAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const note = createNote(db, user.id);
  redirect(`/notes/${note.id}`);
}
