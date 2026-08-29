import { describe, expect, it } from "vitest";
import { findHighlight, matchReasonLabel } from "./searchHighlight";

describe("matchReasonLabel", () => {
  it("title outranks tag and text", () => {
    expect(matchReasonLabel(["title", "tags", "plainText"])).toBe("match in the title");
  });

  it("tag outranks text", () => {
    expect(matchReasonLabel(["tags", "plainText"])).toBe("match in a tag");
  });

  it("text only - match in the text", () => {
    expect(matchReasonLabel(["plainText"])).toBe("match in the text");
  });

  it("empty field list - no label", () => {
    expect(matchReasonLabel([])).toBeNull();
  });
});

describe("findHighlight", () => {
  it("finds a literal substring case-insensitively", () => {
    expect(findHighlight("Relapse Prevention", "prevention")).toEqual({
      before: "Relapse ",
      match: "Prevention",
      after: "",
    });
  });

  it("no literal substring (only a stemmed match) - null", () => {
    expect(findHighlight("Preventing relapses", "prevention")).toBeNull();
  });

  it("empty query - null", () => {
    expect(findHighlight("Any text", "   ")).toBeNull();
  });
});
