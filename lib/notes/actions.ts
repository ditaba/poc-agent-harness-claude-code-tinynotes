"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";
import { createNote, deleteNote, updateNote } from "./repo";
import { validateNoteInput, type NoteInput } from "./validation";

// The only form action (D17). No try/catch: redirect() works by throwing, and an
// unexpected error reaches app/error.tsx (§7).
export async function createNoteAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const note = createNote(db, user.id);
  redirect(`/notes/${note.id}`);
}

export async function saveNoteAction(
  id: string,
  input: NoteInput,
): Promise<ActionResult<{ updatedAt: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "UNAUTHENTICATED" };

    const validated = validateNoteInput(input);
    if (!validated.ok) return validated;

    const updatedAt = Date.now();
    // A note the user doesn't own behaves like a missing one (D24).
    if (!updateNote(db, user.id, id, validated.value, updatedAt)) {
      return { ok: false, error: "NOT_FOUND" };
    }
    revalidatePath("/notes");
    revalidatePath(`/notes/${id}`);
    return { ok: true, data: { updatedAt } };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "INTERNAL" };
  }
}

// No revalidatePath: it would re-render the current page, which is now a 404.
// The client calls router.replace("/notes"), and /notes is dynamic (D41).
export async function deleteNoteAction(id: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "UNAUTHENTICATED" };

    if (!deleteNote(db, user.id, id)) return { ok: false, error: "NOT_FOUND" };
    return { ok: true, data: undefined };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "INTERNAL" };
  }
}
