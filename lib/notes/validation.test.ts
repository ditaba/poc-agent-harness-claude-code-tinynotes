import type { JSONContent } from "@tiptap/core";
import { describe, expect, test } from "bun:test";
import { EMPTY_DOC } from "./editor-extensions";
import { CONTENT_MAX_BYTES, TITLE_MAX_LENGTH, utf8ByteLength } from "./limits";
import { type NoteInput, validateNoteInput } from "./validation";

const emptyContent = JSON.stringify(EMPTY_DOC);

function text(value: string, marks?: JSONContent["marks"]): JSONContent {
  return marks
    ? { type: "text", text: value, marks }
    : { type: "text", text: value };
}

function paragraph(value: string): JSONContent {
  return { type: "paragraph", content: [text(value)] };
}

function listItem(value: string): JSONContent {
  return { type: "listItem", content: [paragraph(value)] };
}

function doc(...content: JSONContent[]): string {
  return JSON.stringify({ type: "doc", content });
}

// A one-paragraph doc whose JSON is exactly `bytes` long in UTF-8. Most of the text is "€"
// (3 bytes, 1 UTF-16 unit), so its .length is far below its byte length.
function docOfBytes(bytes: number): string {
  const overhead = utf8ByteLength(doc(paragraph("")));
  const euros = 20_000;
  return doc(
    paragraph("€".repeat(euros) + "a".repeat(bytes - overhead - euros * 3)),
  );
}

function validateContent(content: string) {
  return validateNoteInput({ title: "", content });
}

describe("validateNoteInput: title", () => {
  test("a 200-char title is ok", () => {
    const title = "a".repeat(TITLE_MAX_LENGTH);
    expect(validateNoteInput({ title, content: emptyContent })).toEqual({
      ok: true,
      value: { title, content: emptyContent },
    });
  });

  test("a 201-char title → TITLE_TOO_LONG", () => {
    expect(
      validateNoteInput({
        title: "a".repeat(TITLE_MAX_LENGTH + 1),
        content: emptyContent,
      }),
    ).toEqual({ ok: false, error: "TITLE_TOO_LONG" });
  });

  test("the limit applies after trimming", () => {
    const title = "a".repeat(TITLE_MAX_LENGTH);
    expect(
      validateNoteInput({ title: `  ${title}  `, content: emptyContent }),
    ).toEqual({ ok: true, value: { title, content: emptyContent } });
  });

  test('"  hi  " → "hi"', () => {
    const result = validateNoteInput({
      title: "  hi  ",
      content: emptyContent,
    });
    expect(result.ok && result.value.title).toBe("hi");
  });

  test('"   " → ""', () => {
    const result = validateNoteInput({ title: "   ", content: emptyContent });
    expect(result.ok && result.value.title).toBe("");
  });

  test("the title is checked before the content", () => {
    expect(
      validateNoteInput({
        title: "a".repeat(TITLE_MAX_LENGTH + 1),
        content: "not json",
      }),
    ).toEqual({ ok: false, error: "TITLE_TOO_LONG" });
  });
});

describe("validateNoteInput: content size (D40)", () => {
  test("normalized JSON of exactly 102 400 bytes is ok", () => {
    const content = docOfBytes(CONTENT_MAX_BYTES);
    expect(utf8ByteLength(content)).toBe(CONTENT_MAX_BYTES);

    const result = validateContent(content);
    expect(result).toEqual({ ok: true, value: { title: "", content } });
  });

  test("102 401 bytes → CONTENT_TOO_LARGE, counting multi-byte chars as bytes", () => {
    const content = docOfBytes(CONTENT_MAX_BYTES + 1);
    expect(utf8ByteLength(content)).toBe(CONTENT_MAX_BYTES + 1);
    expect(content.length).toBeLessThan(CONTENT_MAX_BYTES);

    expect(validateContent(content)).toEqual({
      ok: false,
      error: "CONTENT_TOO_LARGE",
    });
  });

  test("input under the limit that grows past it when normalized → CONTENT_TOO_LARGE", () => {
    // Normalizing adds the default attrs: {"type":"heading"} → {"type":"heading","attrs":{"level":1}}.
    const content = doc(
      ...Array.from({ length: 4_000 }, () => ({ type: "heading" })),
    );
    expect(utf8ByteLength(content)).toBeLessThan(CONTENT_MAX_BYTES);

    expect(validateContent(content)).toEqual({
      ok: false,
      error: "CONTENT_TOO_LARGE",
    });
  });
});

describe("validateNoteInput: schema (D26)", () => {
  test('"not json" → INVALID_CONTENT', () => {
    expect(validateContent("not json")).toEqual({
      ok: false,
      error: "INVALID_CONTENT",
    });
  });

  test("JSON that isn't an object → INVALID_CONTENT", () => {
    for (const content of ["null", '"doc"', "[]", "42"]) {
      expect(validateContent(content)).toEqual({
        ok: false,
        error: "INVALID_CONTENT",
      });
    }
  });

  test("a root paragraph → INVALID_CONTENT", () => {
    expect(validateContent(JSON.stringify(paragraph("hi")))).toEqual({
      ok: false,
      error: "INVALID_CONTENT",
    });
  });

  test("an image node → INVALID_CONTENT", () => {
    expect(
      validateContent(doc({ type: "image", attrs: { src: "x.png" } })),
    ).toEqual({ ok: false, error: "INVALID_CONTENT" });
  });

  test("a link mark → INVALID_CONTENT", () => {
    const linked = text("click", [
      { type: "link", attrs: { href: "javascript:alert(1)" } },
    ]);
    expect(
      validateContent(doc({ type: "paragraph", content: [linked] })),
    ).toEqual({ ok: false, error: "INVALID_CONTENT" });
  });

  test("known nodes that break the content rules → INVALID_CONTENT", () => {
    for (const content of [
      doc(text("text directly in doc")),
      doc(),
      doc({ type: "codeBlock", content: [text("x", [{ type: "bold" }])] }),
    ]) {
      expect(validateContent(content)).toEqual({
        ok: false,
        error: "INVALID_CONTENT",
      });
    }
  });

  test("non-string fields → INVALID_CONTENT", () => {
    for (const input of [
      { title: 1, content: emptyContent },
      { title: "", content: EMPTY_DOC },
      {},
      null,
    ]) {
      expect(validateNoteInput(input as unknown as NoteInput)).toEqual({
        ok: false,
        error: "INVALID_CONTENT",
      });
    }
  });

  test("a valid doc using every D4 format is ok, with unknown attrs dropped", () => {
    const content = doc(
      {
        type: "heading",
        attrs: { level: 2, id: "intro" },
        content: [text("Heading 2")],
      },
      { type: "heading", attrs: { level: 3 }, content: [text("Heading 3")] },
      {
        type: "paragraph",
        attrs: { class: "evil", style: "color: red" },
        content: [
          text("bold", [{ type: "bold", attrs: { onclick: "alert(1)" } }]),
          text(" italic", [{ type: "italic" }]),
          text(" strike", [{ type: "strike" }]),
          text(" code", [{ type: "code" }]),
          { type: "hardBreak" },
          text("after a hard break"),
        ],
      },
      { type: "bulletList", content: [listItem("one"), listItem("two")] },
      {
        type: "orderedList",
        attrs: { start: 1, reversed: true },
        content: [listItem("first")],
      },
      { type: "blockquote", content: [paragraph("quote")] },
      {
        type: "codeBlock",
        attrs: { language: "ts", onmouseover: "alert(1)" },
        content: [text("const x = 1;")],
      },
    );

    const result = validateContent(content);
    if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
    expect(JSON.parse(result.value.content)).toEqual({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [text("Heading 2")],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [text("Heading 3")],
        },
        {
          type: "paragraph",
          content: [
            text("bold", [{ type: "bold" }]),
            text(" italic", [{ type: "italic" }]),
            text(" strike", [{ type: "strike" }]),
            text(" code", [{ type: "code" }]),
            { type: "hardBreak" },
            text("after a hard break"),
          ],
        },
        { type: "bulletList", content: [listItem("one"), listItem("two")] },
        {
          type: "orderedList",
          attrs: { start: 1, type: null },
          content: [listItem("first")],
        },
        { type: "blockquote", content: [paragraph("quote")] },
        {
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [text("const x = 1;")],
        },
      ],
    });
  });
});
