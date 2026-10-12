import { createNoteAction } from "@/lib/notes/actions";

export function NewNoteButton() {
  return (
    <form action={createNoteAction}>
      <button
        type="submit"
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        New note
      </button>
    </form>
  );
}
