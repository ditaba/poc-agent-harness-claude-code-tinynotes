import { getSchema } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { editorExtensions } from "./editor-extensions";
import { CONTENT_MAX_BYTES, TITLE_MAX_LENGTH, utf8ByteLength } from "./limits";

export type NoteInput = { title: string; content: string }; // content = JSON string
export type ValidatedNoteInput = { title: string; content: string }; // trimmed title, normalized JSON

type ValidationResult =
  | { ok: true; value: ValidatedNoteInput }
  | {
      ok: false;
      error: "TITLE_TOO_LONG" | "CONTENT_TOO_LARGE" | "INVALID_CONTENT";
    };

const schema = getSchema(editorExtensions);

// Parsing before the size check is safe: Next's 1 MB request limit bounds the input.
export function validateNoteInput(input: NoteInput): ValidationResult {
  if (typeof input.title !== "string" || typeof input.content !== "string") {
    return { ok: false, error: "INVALID_CONTENT" };
  }

  const title = input.title.trim();
  if (title.length > TITLE_MAX_LENGTH) {
    return { ok: false, error: "TITLE_TOO_LONG" };
  }

  let normalized: string;
  try {
    const json: unknown = JSON.parse(input.content);
    if (
      typeof json !== "object" ||
      json === null ||
      (json as { type?: unknown }).type !== "doc"
    ) {
      return { ok: false, error: "INVALID_CONTENT" };
    }
    // fromJSON rejects unknown nodes and marks and drops unknown attrs (D26).
    const node = Node.fromJSON(schema, json);
    node.check();
    normalized = JSON.stringify(node.toJSON());
  } catch {
    return { ok: false, error: "INVALID_CONTENT" };
  }

  if (utf8ByteLength(normalized) > CONTENT_MAX_BYTES) {
    return { ok: false, error: "CONTENT_TOO_LARGE" };
  }
  return { ok: true, value: { title, content: normalized } };
}
