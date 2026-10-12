"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { callAction } from "@/lib/call-action";
import { ERROR_MESSAGES, type ErrorCode } from "@/lib/errors";
import { deleteNoteAction, saveNoteAction } from "@/lib/notes/actions";
import { editorExtensions } from "@/lib/notes/editor-extensions";
import {
  CONTENT_MAX_BYTES,
  TITLE_MAX_LENGTH,
  utf8ByteLength,
} from "@/lib/notes/limits";
import { MessageRegion, type Message } from "./message-region";

function errorMessage(error: ErrorCode): Message {
  return {
    kind: "error",
    text: ERROR_MESSAGES[error],
    link:
      error === "UNAUTHENTICATED"
        ? { href: "/sign-in", label: "Sign in" }
        : undefined,
  };
}

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
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
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
    // Checked before sending, so no request is made at any size (NOTE-12, D40).
    if (utf8ByteLength(input.content) > CONTENT_MAX_BYTES) {
      setMessage({ kind: "error", text: ERROR_MESSAGES.CONTENT_TOO_LARGE });
      return;
    }
    setMessage(null);
    setSaving(true);
    const result = await callAction(() => saveNoteAction(note.id, input));
    setSaving(false);
    if (!result.ok) {
      setMessage(errorMessage(result.error));
    } else if (editCount.current === editsAtClick) {
      setMessage({ kind: "status", text: "Saved" });
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this note? This can't be undone.")) return;
    setMessage(null);
    setDeleting(true);
    const result = await callAction(() => deleteNoteAction(note.id));
    if (result.ok) {
      // Stays "Deleting…" until the navigation replaces the page (D41).
      router.replace("/notes");
      return;
    }
    setDeleting(false);
    setMessage(errorMessage(result.error));
  }

  // Save and Delete are both disabled while either is pending (D38).
  const pending = saving || deleting;

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
          disabled={!editor || pending}
          className="rounded bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded border border-red-700 px-4 py-2 font-medium text-red-700 disabled:opacity-60 dark:border-red-400 dark:text-red-400"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
        <MessageRegion message={message} />
      </div>
    </div>
  );
}
