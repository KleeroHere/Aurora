import { describe, expect, it } from "vitest";
import type { EditorJsBlock, EditorJsOutputData } from "./types";
import { blockToPrintHtml, buildPrintDocument, collectImageAttachmentKeys, escapeHtml } from "./printHtml";

function doc(blocks: EditorJsBlock[]): EditorJsOutputData {
  return { time: 0, blocks, version: "2.30.0" };
}

describe("all eight block types print", () => {
  it("header - with the level clamped to 1..6", () => {
    expect(blockToPrintHtml({ type: "header", data: { text: "Welcome checklist", level: 2 } })).toBe(
      '<h2 class="print-header">Welcome checklist</h2>',
    );
    expect(blockToPrintHtml({ type: "header", data: { text: "x", level: 99 } })).toContain("<h6");
    expect(blockToPrintHtml({ type: "header", data: { text: "x", level: 0 } })).toContain("<h1");
  });

  it("paragraph - inline markup is preserved", () => {
    const html = blockToPrintHtml({ type: "paragraph", data: { text: "Check the <b>passport</b>" } });
    expect(html).toContain("<b>passport</b>");
  });

  it("list - bulleted, numbered, and nested", () => {
    const items = [
      { content: "First", meta: {}, items: [{ content: "Nested", meta: {}, items: [] }] },
      { content: "Second", meta: {}, items: [] },
    ];
    const unordered = blockToPrintHtml({ type: "list", data: { style: "unordered", meta: {}, items } });
    expect(unordered.startsWith("<ul")).toBe(true);
    expect(unordered).toContain("Nested");

    const ordered = blockToPrintHtml({ type: "list", data: { style: "ordered", meta: {}, items } });
    expect(ordered.startsWith("<ol")).toBe(true);
  });

  it("a checklist prints as SQUARES, not on-screen checkmarks", () => {
    const html = blockToPrintHtml({
      type: "list",
      data: { style: "checklist", meta: {}, items: [{ content: "Hand in the phone", meta: {}, items: [] }] },
    });
    expect(html).toContain("print-checkbox");
    expect(html).not.toContain("<input");
    expect(html).toContain("Hand in the phone");
  });

  it("quote - with and without a caption", () => {
    expect(blockToPrintHtml({ type: "quote", data: { text: "Quote", caption: "Author" } })).toContain(
      "<cite>Author</cite>",
    );
    expect(blockToPrintHtml({ type: "quote", data: { text: "Quote", caption: "" } })).not.toContain("<cite>");
  });

  it("alert - with a human label, not the raw type", () => {
    const html = blockToPrintHtml({ type: "alert", data: { type: "danger", align: "left", text: "Do not leave unattended" } });
    expect(html).toContain("Danger");
    expect(html).toContain("Do not leave unattended");
    expect(html).not.toMatch(/>danger</);
  });

  it("table - with and without a header row", () => {
    const withHeadings = blockToPrintHtml({
      type: "table",
      data: { withHeadings: true, content: [["Time", "Task"], ["07:00", "Wake up"]] },
    });
    expect(withHeadings).toContain("<th>Time</th>");
    expect(withHeadings).toContain("<td>07:00</td>");

    const plain = blockToPrintHtml({
      type: "table",
      data: { withHeadings: false, content: [["a", "b"]] },
    });
    expect(plain).not.toContain("<th>");
  });

  it("image - the attachment picture makes it into print", () => {
    const block: EditorJsBlock = { type: "image", data: { file: { key: "img-1" }, caption: "Diagram" } };
    const html = blockToPrintHtml(block, { "img-1": "blob:http://localhost/abc" });
    expect(html).toContain('src="blob:http://localhost/abc"');
    expect(html).toContain("<figcaption>Diagram</figcaption>");
  });

  it("image with no attachment - an honest note, not broken layout", () => {
    const html = blockToPrintHtml({ type: "image", data: { file: { key: "no-such-key" }, caption: "" } });
    expect(html).toContain("image not found");
    expect(html).not.toContain("<img");
  });

  it("attaches - the file name stays on paper", () => {
    const html = blockToPrintHtml({
      type: "attaches",
      data: { file: { key: "f", name: "blank.pdf", ext: "pdf", size: 10 }, title: "Application form" },
    });
    expect(html).toContain("Application form");
  });
});

describe("assembling the whole document", () => {
  it("title and subtitle are escaped, the body is not", () => {
    const html = buildPrintDocument({
      title: 'Manual <script>alert("x")</script>',
      meta: "Emergency procedures · edited 11.08.2026",
      data: doc([{ type: "paragraph", data: { text: "Text with <b>markup</b>" } }]),
    });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<b>markup</b>");
    expect(html).toContain("Emergency procedures");
  });

  it("several sections with subheadings - this is how a film prints", () => {
    const html = buildPrintDocument({
      title: "Sample film",
      sections: [
        { heading: "Introduction (before the screening)", data: doc([{ type: "paragraph", data: { text: "Before the screening" } }]) },
        { heading: "Discussion questions (after the screening)", data: doc([{ type: "paragraph", data: { text: "What you noticed" } }]) },
      ],
    });
    expect(html).toContain("Introduction (before the screening)");
    expect(html).toContain("Discussion questions (after the screening)");
    expect(html.indexOf("Before the screening")).toBeLessThan(html.indexOf("What you noticed"));
  });

  it("the document is self-contained: styles inside, nothing pulled from outside", () => {
    const html = buildPrintDocument({ title: "T", data: doc([]) });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<style>");
    expect(html).not.toContain("<link");
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("page breaks: tables and headers are not cut", () => {
    const html = buildPrintDocument({ title: "T", data: doc([]) });
    expect(html).toMatch(/\.print-header\s*\{[^}]*break-after:\s*avoid/);
    expect(html).toMatch(/\.print-table\s*\{[^}]*break-inside:\s*avoid/);
  });

  it("the sheet comes out white regardless of the app theme", () => {
    const html = buildPrintDocument({ title: "T", data: doc([]) });
    expect(html).toMatch(/background:\s*#fff/);
    expect(html).toMatch(/color:\s*#000/);
  });
});

describe("preparing the pictures", () => {
  it("attachment keys are collected only from images and without repeats", () => {
    const data = doc([
      { type: "image", data: { file: { key: "a" }, caption: "" } },
      { type: "paragraph", data: { text: "between" } },
      { type: "image", data: { file: { key: "b" }, caption: "" } },
    ]);
    expect(collectImageAttachmentKeys(data)).toEqual(["a", "b"]);
  });
});

describe("escaping", () => {
  it("escapes angle brackets, ampersand, and quotes", () => {
    expect(escapeHtml('<a href="x">&')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;");
  });
});
