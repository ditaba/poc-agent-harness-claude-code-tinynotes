"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../db";
import type { ActionResult } from "../errors";
import { getCurrentUser, type CurrentUser } from "../session";
import { createNote, deleteNote, updateNote } from "./repo";
import { validateNoteInput, type NoteInput } from "./validation";

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

export async function saveNoteAction(
  id: string,
  input: NoteInput,
): Promise<ActionResult<{ updatedAt: number }>> {
  return runNoteAction((user) => {
    const validated = validateNoteInput(input);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }
    const updatedAt = Date.now();
    if (!updateNote(db, user.id, id, validated.value, updatedAt)) {
      return { ok: false, error: "NOT_FOUND" }; // missing or not owned (NOTE-15)
    }
    // The list order and the editor page's title change. The editor ignores its new props, so the
    // revalidated page never resets what the user is typing.
    revalidatePath("/notes");
    revalidatePath(`/notes/${id}`);
    return { ok: true, data: { updatedAt } };
  });
}

export async function deleteNoteAction(id: string): Promise<ActionResult> {
  return runNoteAction((user) => {
    if (!deleteNote(db, user.id, id)) {
      return { ok: false, error: "NOT_FOUND" }; // missing or not owned (NOTE-15)
    }
    // No revalidatePath: it would re-render the current page, which is now a 404. The client then calls
    // router.replace("/notes"), and /notes is dynamic, so it is fetched fresh (D41).
    return { ok: true, data: undefined };
  });
}

// The shape every action called from client code shares (§9): no session → UNAUTHENTICATED, and an unexpected
// error is logged and becomes INTERNAL, so the client only ever sees an ErrorCode. They never redirect (D41).
async function runNoteAction<T>(
  run: (user: CurrentUser) => ActionResult<T>,
): Promise<ActionResult<T>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { ok: false, error: "UNAUTHENTICATED" };
    }
    return run(user);
  } catch (error) {
    console.error("Note action failed:", error);
    return { ok: false, error: "INTERNAL" };
  }
}
