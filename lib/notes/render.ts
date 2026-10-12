import type { JSONContent } from "@tiptap/core";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import { editorExtensions } from "./editor-extensions";

// Server-side JSON → HTML with the editor's extension list (D14, PUB-4).
export function renderNoteHtml(content: JSONContent): string {
  return renderToHTMLString({ extensions: editorExtensions, content });
}
