import { describe, expect, it } from "vitest";
import {
  computeArticleDerivedFields,
  computeExcerpt,
  computeFileDerivedFields,
  computeFilmDerivedFields,
  computeReadingTime,
  extractPlainTextFromBlocks,
} from "./derived";
import { buildOutputData, eBlockHeader, eBlockList, eBlockParagraph } from "./seedData";
import type { EditorJsListItem } from "./types";

describe("computeArticleDerivedFields: empty body", () => {
  it("body with empty blocks[] yields plainText='', excerpt='', readingTime=1 (not 0 - the max(1, ...) formula)", () => {
    const empty = buildOutputData([]);
    const derived = computeArticleDerivedFields(empty);
    expect(derived.plainText).toBe("");
    expect(derived.excerpt).toBe("");
    expect(derived.readingTime).toBe(1);
  });
});

describe("computeArticleDerivedFields: single-block body", () => {
  it("a single short paragraph block - plainText/excerpt match verbatim, readingTime=1", () => {
    const body = buildOutputData([eBlockParagraph("A short text.")]);
    const derived = computeArticleDerivedFields(body);
    expect(derived.plainText).toBe("A short text.");
    expect(derived.excerpt).toBe("A short text.");
    expect(derived.readingTime).toBe(1);
  });

  it("a single header block also contributes to plainText (not just paragraph)", () => {
    const body = buildOutputData([eBlockHeader("Article heading")]);
    const derived = computeArticleDerivedFields(body);
    expect(derived.plainText).toBe("Article heading");
  });

  it("readingTime grows with text volume via max(1, round(words/180)) - v1 parity", () => {
    const words360 = Array(360).fill("word").join(" ");
    const body = buildOutputData([eBlockParagraph(words360)]);
    const derived = computeArticleDerivedFields(body);
    expect(derived.readingTime).toBe(2); // round(360/180) = 2
  });
});

describe("computeExcerpt: truncation boundary (maxLen=180)", () => {
  it("text shorter than the limit is returned unchanged and without an ellipsis", () => {
    expect(computeExcerpt("Just a short text.")).toBe("Just a short text.");
  });

  it("text longer than the limit is cut at a word boundary and gets an ellipsis", () => {
    const longText = "word".repeat(1).concat(" ") + "a".repeat(250);
    const excerpt = computeExcerpt(longText, 180);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt.length).toBeLessThanOrEqual(182); // 180 + "…" + slack for the word boundary
  });

  it("text exactly at the limit (length === maxLen) is not cut", () => {
    const exact = "a".repeat(180);
    expect(computeExcerpt(exact, 180)).toBe(exact);
  });

  it("text 1 character over the limit is already cut (we check the CONTENT, not the total string length: 180 characters + a length-1 ellipsis equal the 181-character input in length by pure arithmetic, which is no sign that truncation was skipped)", () => {
    const overByOne = "a".repeat(181);
    const excerpt = computeExcerpt(overByOne, 180);
    expect(excerpt).toBe(`${"a".repeat(180)}…`);
    expect(excerpt).not.toBe(overByOne);
  });
});

describe("computeReadingTime: edge cases", () => {
  it("empty string yields 1, not 0", () => {
    expect(computeReadingTime("")).toBe(1);
  });

  it("whitespace-only string yields 1, not NaN/0", () => {
    expect(computeReadingTime("   \n\t  ")).toBe(1);
  });
});

describe("extractPlainTextFromBlocks: recursive @editorjs/list", () => {
  function item(content: string, items: EditorJsListItem[] = []): EditorJsListItem {
    return { content, meta: {}, items };
  }

  it("flat list (no nesting) - every item lands in plainText in order", () => {
    const body = buildOutputData([eBlockList("unordered", [{ content: "One" }, { content: "Two" }])]);
    expect(extractPlainTextFromBlocks(body)).toBe("One Two");
  });

  it("list with ONE nesting level - the nested item also lands in plainText", () => {
    const body = buildOutputData([
      eBlockList("ordered", [{ content: "Parent", items: [{ content: "Subitem" }] }]),
    ]);
    expect(extractPlainTextFromBlocks(body)).toBe("Parent Subitem");
  });

  it("list with THREE nesting levels (item -> subitem -> subsubitem) - recursion reaches the bottom", () => {
    const deepList = {
      type: "list" as const,
      data: {
        style: "ordered" as const,
        meta: { counterType: "numeric", start: 1 },
        items: [
          item("Level 1", [item("Level 2", [item("Level 3")])]),
        ],
      },
    };
    const body = buildOutputData([deepList]);
    expect(extractPlainTextFromBlocks(body)).toBe("Level 1 Level 2 Level 3");
  });

  it("several branches on one level - traversal keeps document order, no shuffling", () => {
    const body = buildOutputData([
      eBlockList("ordered", [
        { content: "First", items: [{ content: "1.1" }, { content: "1.2" }] },
        { content: "Second", items: [{ content: "2.1" }] },
      ]),
    ]);
    expect(extractPlainTextFromBlocks(body)).toBe("First 1.1 1.2 Second 2.1");
  });

  it("empty items[] on a list item does not break the recursion (base case)", () => {
    const body = buildOutputData([eBlockList("unordered", [{ content: "No subitems", items: [] }])]);
    expect(extractPlainTextFromBlocks(body)).toBe("No subitems");
  });
});

describe("computeFilmDerivedFields: intro/questions asymmetry", () => {
  it("non-empty intro and questions - plainText contains both, readingTime is computed from intro", () => {
    const intro = buildOutputData([eBlockParagraph("Introductory part of the film.")]);
    const questions = buildOutputData([eBlockParagraph("A question for discussion.")]);
    const derived = computeFilmDerivedFields(intro, questions);
    expect(derived.plainText).toContain("Introductory part of the film");
    expect(derived.plainText).toContain("A question for discussion");
    expect(derived.readingTime).toBe(1);
  });

  it("FINDING (documented, not a bug): empty intro with non-empty questions yields readingTime=null even though plainText is non-empty", () => {
    const emptyIntro = buildOutputData([]);
    const questions = buildOutputData([eBlockParagraph("A question without an intro.")]);
    const derived = computeFilmDerivedFields(emptyIntro, questions);
    expect(derived.plainText).toBe("A question without an intro.");
    expect(derived.readingTime).toBeNull();
  });

  it("intro and questions both empty - plainText='', readingTime=null", () => {
    const derived = computeFilmDerivedFields(buildOutputData([]), buildOutputData([]));
    expect(derived.plainText).toBe("");
    expect(derived.readingTime).toBeNull();
  });
});

describe("computeFileDerivedFields", () => {
  it("no full text - the title remains, as it always has", () => {
    expect(computeFileDerivedFields("Survey").plainText).toBe("Survey");
    expect(computeFileDerivedFields("Survey", "").plainText).toBe("Survey");
  });

  it("full text present - editing the title leaves it untouched", () => {
    const text = "Document text about project stages and working with archived records.";
    const derived = computeFileDerivedFields("New name", text, "Old name");
    expect(derived.plainText).toBe(text);
  });

  it("a title placeholder (materials from before task 15) is updated to the new name", () => {
    const derived = computeFileDerivedFields("New name", "Old name", "Old name");
    expect(derived.plainText).toBe("New name");
  });

  it("the placeholder is recognized even with surrounding whitespace differences", () => {
    const derived = computeFileDerivedFields("New name", "  Old name  ", "Old name");
    expect(derived.plainText).toBe("New name");
  });

  it("without a previous title the full text is kept - this is the CREATE path", () => {
    const derived = computeFileDerivedFields("Survey", "Text from the PDF");
    expect(derived.plainText).toBe("Text from the PDF");
  });

  it("excerpt for file types is still null (schema §5)", () => {
    expect(computeFileDerivedFields("Survey", "Text").excerpt).toBeNull();
  });
});
