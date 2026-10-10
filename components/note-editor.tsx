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
  // Title and editor start from the page load. Later props (e.g. after a save's revalidation) are ignored,
  // so they never reset what the user is typing.
  const [title, setTitle] = useState(note.title);
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
  });

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        aria-label="Title"
        placeholder="Untitled"
        maxLength={TITLE_MAX_LENGTH}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-2xl font-semibold"
      />
      {/* The box is server-rendered, so the page doesn't shift when the editor mounts. As a grid, it
          stretches the editor to its full height, so a click anywhere in it focuses the editor. */}
      <EditorContent
        editor={editor}
        className="grid min-h-64 rounded-md border border-zinc-300 bg-white focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-300"
      />
    </div>
  );
}
