import { getSchema } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { editorExtensions } from "./editor-extensions";
import { CONTENT_MAX_BYTES, TITLE_MAX_LENGTH, utf8ByteLength } from "./limits";

export type NoteInput = { title: string; content: string }; // content = JSON string
export type ValidatedNoteInput = { title: string; content: string }; // trimmed title, normalized JSON

export type NoteInputError =
  "TITLE_TOO_LONG" | "CONTENT_TOO_LARGE" | "INVALID_CONTENT";

const schema = getSchema(editorExtensions);

export function validateNoteInput(
  input: NoteInput,
):
  | { ok: true; value: ValidatedNoteInput }
  | { ok: false; error: NoteInputError } {
  // Server Action arguments come from the client, so the declared types aren't guaranteed.
  const title: unknown = input?.title;
  const content: unknown = input?.content;
  if (typeof title !== "string" || typeof content !== "string") {
    return { ok: false, error: "INVALID_CONTENT" };
  }

  const trimmedTitle = title.trim();
  if (trimmedTitle.length > TITLE_MAX_LENGTH) {
    return { ok: false, error: "TITLE_TOO_LONG" };
  }

  const normalized = normalizeContent(content);
  if (normalized === null) {
    return { ok: false, error: "INVALID_CONTENT" };
  }
  // Checked after normalizing, because normalizing can add default attrs (D40).
  if (utf8ByteLength(normalized) > CONTENT_MAX_BYTES) {
    return { ok: false, error: "CONTENT_TOO_LARGE" };
  }

  return { ok: true, value: { title: trimmedTitle, content: normalized } };
}

// Parses content against the editor schema (D26): unknown nodes and marks throw, unknown attrs are
// dropped, and missing attrs get their defaults. Returns the JSON to store, or null when invalid.
function normalizeContent(content: string): string | null {
  try {
    const json: unknown = JSON.parse(content);
    if (
      typeof json !== "object" ||
      json === null ||
      !("type" in json) ||
      json.type !== "doc"
    ) {
      return null;
    }
    const node = Node.fromJSON(schema, json);
    node.check();
    return JSON.stringify(node.toJSON());
  } catch {
    return null;
  }
}
