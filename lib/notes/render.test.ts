import type { JSONContent } from "@tiptap/core";
import { describe, expect, test } from "bun:test";
import { renderNoteHtml } from "./render";

const ALLOWED_TAGS = new Set([
  "p",
  "h2",
  "h3",
  "strong",
  "em",
  "s",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "br",
]);

function text(value: string, marks?: JSONContent["marks"]): JSONContent {
  return marks
    ? { type: "text", text: value, marks }
    : { type: "text", text: value };
}

function paragraph(...content: JSONContent[]): JSONContent {
  return { type: "paragraph", content };
}

function doc(...content: JSONContent[]): JSONContent {
  return { type: "doc", content };
}

function tagsIn(html: string): string[] {
  return [...html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) =>
    m[1].toLowerCase(),
  );
}

const everyFormatDoc = doc(
  { type: "heading", attrs: { level: 2 }, content: [text("Heading 2")] },
  { type: "heading", attrs: { level: 3 }, content: [text("Heading 3")] },
  paragraph(
    text("bold", [{ type: "bold" }]),
    text("italic", [{ type: "italic" }]),
    text("strike", [{ type: "strike" }]),
    text("code", [{ type: "code" }]),
    { type: "hardBreak" },
    text("after break"),
  ),
  {
    type: "bulletList",
    content: [{ type: "listItem", content: [paragraph(text("bullet"))] }],
  },
  {
    type: "orderedList",
    attrs: { start: 1 },
    content: [{ type: "listItem", content: [paragraph(text("numbered"))] }],
  },
  { type: "blockquote", content: [paragraph(text("quote"))] },
  {
    type: "codeBlock",
    attrs: { language: "ts" },
    content: [text("const x = 1;")],
  },
);

describe("renderNoteHtml tags (PUB-4, D4)", () => {
  test.each([
    [
      "heading level 2",
      doc({ type: "heading", attrs: { level: 2 }, content: [text("t")] }),
      "<h2>t</h2>",
    ],
    [
      "heading level 3",
      doc({ type: "heading", attrs: { level: 3 }, content: [text("t")] }),
      "<h3>t</h3>",
    ],
    ["paragraph", doc(paragraph(text("t"))), "<p>t</p>"],
    [
      "bold",
      doc(paragraph(text("t", [{ type: "bold" }]))),
      "<strong>t</strong>",
    ],
    ["italic", doc(paragraph(text("t", [{ type: "italic" }]))), "<em>t</em>"],
    ["strike", doc(paragraph(text("t", [{ type: "strike" }]))), "<s>t</s>"],
    [
      "inline code",
      doc(paragraph(text("t", [{ type: "code" }]))),
      "<code>t</code>",
    ],
    [
      "hard break",
      doc(paragraph(text("a"), { type: "hardBreak" }, text("b"))),
      "<br",
    ],
    [
      "bullet list",
      doc({
        type: "bulletList",
        content: [{ type: "listItem", content: [paragraph(text("t"))] }],
      }),
      "<ul><li><p>t</p></li></ul>",
    ],
    [
      "numbered list",
      doc({
        type: "orderedList",
        content: [{ type: "listItem", content: [paragraph(text("t"))] }],
      }),
      "<ol><li><p>t</p></li></ol>",
    ],
    [
      "blockquote",
      doc({ type: "blockquote", content: [paragraph(text("t"))] }),
      "<blockquote><p>t</p></blockquote>",
    ],
    [
      "code block",
      doc({ type: "codeBlock", content: [text("t")] }),
      "<pre><code",
    ],
  ])("%s", (_name, content, expected) => {
    expect(renderNoteHtml(content)).toContain(expected);
  });

  test("doc using every format renders only PUB-4 tags", () => {
    const tags = tagsIn(renderNoteHtml(everyFormatDoc));
    expect(new Set(tags)).toEqual(ALLOWED_TAGS);
  });
});

describe("renderNoteHtml escaping (PUB-4, R4)", () => {
  test("text <script> is escaped", () => {
    const html = renderNoteHtml(
      doc(paragraph(text("<script>alert(1)</script>"))),
    );
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script");
  });

  test("code-block language attr is escaped", () => {
    const html = renderNoteHtml(
      doc({
        type: "codeBlock",
        attrs: { language: '"><img src=x onerror=alert(1)>' },
        content: [text("t")],
      }),
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain('"><');
    expect(tagsIn(html).every((tag) => ALLOWED_TAGS.has(tag))).toBe(true);
  });
});
