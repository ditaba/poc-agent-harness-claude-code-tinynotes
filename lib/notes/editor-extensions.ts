import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

// The single extension list shared by the editor, validation and rendering (D4).
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
