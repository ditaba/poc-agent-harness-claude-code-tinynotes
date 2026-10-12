import { describe, expect, test } from "bun:test";
import { CONTENT_MAX_BYTES, utf8ByteLength } from "./limits";
import { validateNoteInput } from "./validation";

const emptyDoc = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});

function docWithText(text: string): string {
  return JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
}

// Text whose normalized doc JSON is exactly `bytes` long. Uses 2-byte "é" so
// the character count and the byte count differ.
function textForNormalizedBytes(bytes: number): string {
  const result = validateNoteInput({ title: "", content: docWithText("a") });
  if (!result.ok) throw new Error("fixture doc is invalid");
  const remaining = bytes - (utf8ByteLength(result.value.content) - 1);
  return "é".repeat(Math.floor(remaining / 2)) + "a".repeat(remaining % 2);
}

describe("validateNoteInput title (D18)", () => {
  test("200-char title is ok", () => {
    const title = "t".repeat(200);
    expect(validateNoteInput({ title, content: emptyDoc })).toEqual({
      ok: true,
      value: { title, content: emptyDoc },
    });
  });

  test("201-char title → TITLE_TOO_LONG", () => {
    expect(
      validateNoteInput({ title: "t".repeat(201), content: emptyDoc }),
    ).toEqual({ ok: false, error: "TITLE_TOO_LONG" });
  });

  test('"  hi  " is trimmed to "hi"', () => {
    const result = validateNoteInput({ title: "  hi  ", content: emptyDoc });
    expect(result.ok && result.value.title).toBe("hi");
  });

  test('"   " is trimmed to ""', () => {
    const result = validateNoteInput({ title: "   ", content: emptyDoc });
    expect(result.ok && result.value.title).toBe("");
  });

  test("non-string fields → INVALID_CONTENT", () => {
    const input = { title: 1, content: emptyDoc } as unknown as {
      title: string;
      content: string;
    };
    expect(validateNoteInput(input)).toEqual({
      ok: false,
      error: "INVALID_CONTENT",
    });
  });
});

describe("validateNoteInput content size (D40)", () => {
  test("normalized JSON of exactly 102 400 bytes is ok", () => {
    const text = textForNormalizedBytes(CONTENT_MAX_BYTES);
    expect(text.length).toBeLessThan(CONTENT_MAX_BYTES);
    const result = validateNoteInput({ title: "", content: docWithText(text) });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(utf8ByteLength(result.value.content)).toBe(CONTENT_MAX_BYTES);
    }
  });

  test("102 401 bytes → CONTENT_TOO_LARGE, multi-byte chars count as bytes", () => {
    const text = textForNormalizedBytes(CONTENT_MAX_BYTES + 1);
    expect(text.length).toBeLessThan(CONTENT_MAX_BYTES);
    expect(
      validateNoteInput({ title: "", content: docWithText(text) }),
    ).toEqual({ ok: false, error: "CONTENT_TOO_LARGE" });
  });

  test("input under the limit that grows past it when normalized → CONTENT_TOO_LARGE", () => {
    const content = JSON.stringify({
      type: "doc",
      content: Array.from({ length: 5000 }, () => ({ type: "heading" })),
    });
    expect(utf8ByteLength(content)).toBeLessThan(CONTENT_MAX_BYTES);
    expect(validateNoteInput({ title: "", content })).toEqual({
      ok: false,
      error: "CONTENT_TOO_LARGE",
    });
  });
});

describe("validateNoteInput schema (D26)", () => {
  const invalid = { ok: false, error: "INVALID_CONTENT" } as const;

  test('"not json" → INVALID_CONTENT', () => {
    expect(validateNoteInput({ title: "", content: "not json" })).toEqual(
      invalid,
    );
  });

  test("root paragraph → INVALID_CONTENT", () => {
    const content = JSON.stringify({
      type: "paragraph",
      content: [{ type: "text", text: "hi" }],
    });
    expect(validateNoteInput({ title: "", content })).toEqual(invalid);
  });

  test("image node → INVALID_CONTENT", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [{ type: "image", attrs: { src: "https://example.com/x.png" } }],
    });
    expect(validateNoteInput({ title: "", content })).toEqual(invalid);
  });

  test("link mark → INVALID_CONTENT", () => {
    const content = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "hi",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
      ],
    });
    expect(validateNoteInput({ title: "", content })).toEqual(invalid);
  });

  test("a doc using every D4 format is ok and unknown attrs are dropped", () => {
    const text = (value: string, marks?: { type: string }[]) => ({
      type: "text",
      text: value,
      ...(marks ? { marks } : {}),
    });
    const item = (value: string) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [text(value)] }],
    });
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [text("H2")] },
        { type: "heading", attrs: { level: 3 }, content: [text("H3")] },
        {
          type: "paragraph",
          attrs: { foo: "bar" },
          content: [
            text("bold", [{ type: "bold" }]),
            text("italic", [{ type: "italic" }]),
            text("strike", [{ type: "strike" }]),
            text("code", [{ type: "code" }]),
            { type: "hardBreak" },
            text("after break"),
          ],
        },
        { type: "bulletList", content: [item("one"), item("two")] },
        { type: "orderedList", content: [item("first")] },
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [text("quote")] }],
        },
        {
          type: "codeBlock",
          attrs: { language: "ts", evil: "x" },
          content: [text("const a = 1;")],
        },
      ],
    };

    const result = validateNoteInput({
      title: "",
      content: JSON.stringify(doc),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = JSON.parse(result.value.content);
    expect(stored.content).toHaveLength(doc.content.length);
    expect(stored.content[0].attrs.level).toBe(2);
    expect(stored.content[6].attrs.language).toBe("ts");
    expect(result.value.content).not.toContain("foo");
    expect(result.value.content).not.toContain("evil");
  });
});
