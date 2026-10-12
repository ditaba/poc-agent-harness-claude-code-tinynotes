import type { JSONContent } from "@tiptap/core";
import { renderNoteHtml } from "@/lib/notes/render";

// The only dangerouslySetInnerHTML in the app (§10). The static renderer
// escapes all text and emits schema tags only (PUB-4).
export function NoteContent({ content }: { content: JSONContent }) {
  return (
    <div
      className="note-content"
      dangerouslySetInnerHTML={{ __html: renderNoteHtml(content) }}
    />
  );
}
