"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useState } from "react";
import { editorExtensions } from "@/lib/notes/editor-extensions";
import { TITLE_MAX_LENGTH } from "@/lib/notes/limits";

export function NoteEditor({
  note,
}: {
  note: { id: string; title: string; content: JSONContent };
}) {
  const [title, setTitle] = useState(note.title);
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
  });

  return (
    <div className="mt-4 flex flex-col gap-4">
      <input
        type="text"
        aria-label="Title"
        placeholder="Untitled"
        maxLength={TITLE_MAX_LENGTH}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="w-full rounded border border-zinc-300 px-3 py-2 text-xl font-semibold dark:border-zinc-700 dark:bg-zinc-900"
      />
      <EditorContent editor={editor} />
    </div>
  );
}
