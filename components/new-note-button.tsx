import { createNoteAction } from "@/lib/notes/actions";

// A plain form, so "New note" works as a server-side form post; the action redirects to the new note (D17).
export function NewNoteButton() {
  return (
    <form action={createNoteAction}>
      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        New note
      </button>
    </form>
  );
}
