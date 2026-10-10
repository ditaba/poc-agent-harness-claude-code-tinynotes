"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useRef, useState, useTransition } from "react";
import { callAction } from "@/lib/call-action";
import { ERROR_MESSAGES } from "@/lib/errors";
import { saveNoteAction } from "@/lib/notes/actions";
import { editorExtensions } from "@/lib/notes/editor-extensions";
import { TITLE_MAX_LENGTH } from "@/lib/notes/limits";
import { MessageRegion, type Message } from "./message-region";

export function NoteEditor({
  note,
}: {
  note: { id: string; title: string; content: JSONContent };
}) {
  // Title and editor start from the page load. Later props (e.g. after a save's revalidation) are ignored,
  // so they never reset what the user is typing.
  const [title, setTitle] = useState(note.title);
  // The editor's message region: results of Save (MSG-1, D37).
  const [message, setMessage] = useState<Message | null>(null);
  const [isSaving, startSaving] = useTransition();
  // Bumped on every title or content change. A save shows "Saved" only if it hasn't moved since the click (D38).
  const editCount = useRef(0);

  function handleEdit() {
    editCount.current += 1;
    // "Saved" clears on any edit, but an error stays until the next action (NOTE-8, MSG-2).
    setMessage((current) => (current?.type === "status" ? null : current));
  }

  // immediatelyRender: false keeps the editor out of the server HTML, so hydration can't mismatch (R3).
  // With no deps, the editor is created once and keeps its content across re-renders.
  const editor = useEditor({
    extensions: editorExtensions,
    content: note.content,
    immediatelyRender: false,
    editorProps: {
      // TipTap adds role="textbox"; .note-content styles the rich text (D34).
      attributes: {
        class: "note-content px-3 py-2 outline-none",
        "aria-label": "Note content",
        "aria-multiline": "true",
      },
    },
    onUpdate: handleEdit, // only for document changes, not selection moves
  });

  function handleSave() {
    if (!editor) {
      return; // not mounted yet
    }
    // The title and content as they are at the click are what gets saved (NOTE-7). Both stay editable
    // while the save is pending (D38).
    const input = { title, content: JSON.stringify(editor.getJSON()) };
    const editCountAtClick = editCount.current;
    setMessage(null); // starting an action clears its region (MSG-2)
    startSaving(async () => {
      const result = await callAction(() => saveNoteAction(note.id, input));
      // Updates after an await need their own transition.
      startSaving(() => {
        if (!result.ok) {
          setMessage({ type: "error", content: ERROR_MESSAGES[result.error] });
        } else if (editCount.current === editCountAtClick) {
          setMessage({ type: "status", content: "Saved" });
        }
        // Otherwise no status: the edits made since the click aren't saved (NOTE-7).
      });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        aria-label="Title"
        placeholder="Untitled"
        maxLength={TITLE_MAX_LENGTH}
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          handleEdit();
        }}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-2xl font-semibold"
      />
      {/* The box is server-rendered, so the page doesn't shift when the editor mounts. As a grid, it
          stretches the editor to its full height, so a click anywhere in it focuses the editor. */}
      <EditorContent
        editor={editor}
        className="grid min-h-64 rounded-md border border-zinc-300 bg-white focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-300"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
        <MessageRegion message={message} />
      </div>
    </div>
  );
}
