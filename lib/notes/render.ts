import type { JSONContent } from "@tiptap/core";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import { editorExtensions } from "./editor-extensions";

// Server-side JSON → HTML for the shared page (D14). The output goes into NoteContent's
// dangerouslySetInnerHTML, so it relies on the static renderer escaping text and attrs (PUB-4, R4).
export function renderNoteHtml(content: JSONContent): string {
  return renderToHTMLString({ extensions: editorExtensions, content });
}
