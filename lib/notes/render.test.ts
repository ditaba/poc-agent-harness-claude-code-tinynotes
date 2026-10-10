import type { JSONContent } from "@tiptap/core";
import { describe, expect, test } from "bun:test";
import { EMPTY_DOC } from "./editor-extensions";
import { renderNoteHtml } from "./render";

// PUB-4: the only tags the shared page may contain.
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

function listItem(value: string): JSONContent {
  return { type: "listItem", content: [paragraph(text(value))] };
}

function doc(...content: JSONContent[]): JSONContent {
  return { type: "doc", content };
}

function tagNames(html: string): string[] {
  return [...html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)/g)].map((match) =>
    match[1].toLowerCase(),
  );
}

describe("renderNoteHtml: tags (PUB-4)", () => {
  test.each<[string, JSONContent, string]>([
    ["paragraph", paragraph(text("x")), "<p>x</p>"],
    [
      "heading 2",
      { type: "heading", attrs: { level: 2 }, content: [text("x")] },
      "<h2>x</h2>",
    ],
    [
      "heading 3",
      { type: "heading", attrs: { level: 3 }, content: [text("x")] },
      "<h3>x</h3>",
    ],
    [
      "bold",
      paragraph(text("x", [{ type: "bold" }])),
      "<p><strong>x</strong></p>",
    ],
    ["italic", paragraph(text("x", [{ type: "italic" }])), "<p><em>x</em></p>"],
    ["strike", paragraph(text("x", [{ type: "strike" }])), "<p><s>x</s></p>"],
    [
      "inline code",
      paragraph(text("x", [{ type: "code" }])),
      "<p><code>x</code></p>",
    ],
    [
      "bullet list",
      { type: "bulletList", content: [listItem("x")] },
      "<ul><li><p>x</p></li></ul>",
    ],
    [
      "numbered list",
      {
        type: "orderedList",
        attrs: { start: 1, type: null },
        content: [listItem("x")],
      },
      "<ol><li><p>x</p></li></ol>",
    ],
    [
      "blockquote",
      { type: "blockquote", content: [paragraph(text("x"))] },
      "<blockquote><p>x</p></blockquote>",
    ],
    [
      "code block",
      { type: "codeBlock", attrs: { language: null }, content: [text("x")] },
      "<pre><code>x</code></pre>",
    ],
    [
      "hard break",
      paragraph(text("a"), { type: "hardBreak" }, text("b")),
      "<p>a<br/>b</p>",
    ],
  ])("%s", (_name, node, expected) => {
    expect(renderNoteHtml(doc(node))).toBe(expected);
  });

  test("EMPTY_DOC renders one empty paragraph", () => {
    expect(renderNoteHtml(EMPTY_DOC)).toBe("<p></p>");
  });

  test("a heading level outside [2, 3] renders as h2", () => {
    // Validation keeps attr values as given (no attr validate functions), so a stored
    // heading can carry any level. TipTap falls back to levels[0].
    for (const level of [1, 4, '"><img src=x onerror=alert(1)>']) {
      expect(
        renderNoteHtml(
          doc({ type: "heading", attrs: { level }, content: [text("x")] }),
        ),
      ).toBe("<h2>x</h2>");
    }
  });

  test("a doc using every format renders no tags outside the PUB-4 list", () => {
    const html = renderNoteHtml(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [text("Heading 2")] },
        { type: "heading", attrs: { level: 3 }, content: [text("Heading 3")] },
        paragraph(
          text("bold", [{ type: "bold" }]),
          text(" italic", [{ type: "italic" }]),
          text(" strike", [{ type: "strike" }]),
          text(" code", [{ type: "code" }]),
          text(" all", [
            { type: "bold" },
            { type: "italic" },
            { type: "strike" },
          ]),
          { type: "hardBreak" },
          text("<script>alert(1)</script>"),
        ),
        { type: "paragraph" },
        { type: "bulletList", content: [listItem("one"), listItem("two")] },
        {
          type: "orderedList",
          attrs: { start: 3, type: null },
          content: [listItem("three")],
        },
        {
          type: "blockquote",
          content: [
            paragraph(text("quote")),
            { type: "bulletList", content: [listItem("nested")] },
          ],
        },
        {
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [text("if (a < b) {}")],
        },
      ),
    );

    const tags = tagNames(html);
    expect(tags).toContain("strong");
    expect(tags.filter((tag) => !ALLOWED_TAGS.has(tag))).toEqual([]);
  });
});

describe("renderNoteHtml: escaping (PUB-4, R4)", () => {
  test("text <script>alert(1)</script> is escaped", () => {
    expect(
      renderNoteHtml(doc(paragraph(text("<script>alert(1)</script>")))),
    ).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  test("& in text is escaped", () => {
    expect(renderNoteHtml(doc(paragraph(text("a &lt; b & c"))))).toBe(
      "<p>a &amp;lt; b &amp; c</p>",
    );
  });

  test("text in marks and code blocks is escaped", () => {
    expect(
      renderNoteHtml(
        doc(
          paragraph(
            text("<b>", [{ type: "bold" }]),
            text("</code>", [{ type: "code" }]),
          ),
          { type: "codeBlock", content: [text("</code><img src=x>")] },
        ),
      ),
    ).toBe(
      "<p><strong>&lt;b&gt;</strong><code>&lt;/code&gt;</code></p>" +
        "<pre><code>&lt;/code&gt;&lt;img src=x&gt;</code></pre>",
    );
  });

  test('a code-block language attr containing "><img src=x onerror=alert(1)> is escaped', () => {
    const html = renderNoteHtml(
      doc({
        type: "codeBlock",
        attrs: { language: '"><img src=x onerror=alert(1)>' },
        content: [text("x")],
      }),
    );

    expect(html).toBe(
      '<pre><code class="language-&quot;&gt;&lt;img src=x onerror=alert(1)&gt;">x</code></pre>',
    );
    expect(tagNames(html)).toEqual(["pre", "code", "code", "pre"]);
  });

  test("an ordered-list start attr is escaped", () => {
    const html = renderNoteHtml(
      doc({
        type: "orderedList",
        attrs: { start: '"><img src=x onerror=alert(1)>', type: null },
        content: [listItem("x")],
      }),
    );

    expect(html).toBe(
      '<ol start="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"><li><p>x</p></li></ol>',
    );
  });
});
