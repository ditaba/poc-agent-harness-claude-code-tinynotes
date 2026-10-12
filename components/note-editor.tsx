"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useRef, useState } from "react";
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
  // Title and editor state live here, so revalidation re-renders after a save
  // don't reset them: note props are only initial values.
  const [title, setTitle] = useState(note.title);
  const [message, setMessage] = useState<Message | null>(null);
  const [saving, setSaving] = useState(false);
  // Bumped on every title or content change; "Saved" is shown only if it
  // hasn't moved since the click (D38).
  const editCount = useRef(0);

  function handleEdit() {
    editCount.current += 1;
    // "Saved" clears on edit, errors stay until the next action (NOTE-8, MSG-2).
    setMessage((current) => (current?.kind === "status" ? null : current));
  }

  const editor = useEditor({
    extensions: editorExtensions,
    content: note.content,
    // The editor renders only in the browser, avoiding a hydration mismatch (R3).
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "note-content min-h-64 rounded border border-zinc-300 px-3 py-2 focus:outline-2 focus:outline-zinc-500 dark:border-zinc-700",
        "aria-label": "Note content",
      },
    },
    onUpdate: handleEdit,
  });

  async function handleSave() {
    if (!editor) return;
    const editsAtClick = editCount.current;
    const input = { title, content: JSON.stringify(editor.getJSON()) };
    setMessage(null);
    setSaving(true);
    const result = await callAction(() => saveNoteAction(note.id, input));
    setSaving(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: ERROR_MESSAGES[result.error] });
    } else if (editCount.current === editsAtClick) {
      setMessage({ kind: "status", text: "Saved" });
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
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
        className="w-full rounded border border-zinc-300 px-3 py-2 text-xl font-semibold dark:border-zinc-700 dark:bg-zinc-900"
      />
      <EditorContent editor={editor} />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={!editor || saving}
          className="rounded bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <MessageRegion message={message} />
      </div>
    </div>
  );
}
