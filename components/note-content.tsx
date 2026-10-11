import type { JSONContent } from "@tiptap/core";
import { renderNoteHtml } from "@/lib/notes/render";

export function NoteContent({ content }: { content: JSONContent }) {
  return (
    <div
      className="note-content"
      dangerouslySetInnerHTML={{ __html: renderNoteHtml(content) }}
    />
  );
}
