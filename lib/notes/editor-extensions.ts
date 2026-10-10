import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

// The single extension list for the editor, server validation and server rendering.
// Changing formatting support (D4) means changing only this file.
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    link: false,
    underline: false,
    horizontalRule: false,
  }),
];

export const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
