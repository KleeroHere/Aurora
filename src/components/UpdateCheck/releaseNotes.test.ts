import { describe, expect, it } from "vitest";
import { parseNotes } from "./releaseNotes";

describe("release notes are parsed into readable blocks", () => {
  it("an old-style one-line note becomes a paragraph, losing nothing", () => {
    const notes =
      "Aurora 1.2: training videos in materials, data exchange between machines, updates from inside the app.";
    expect(parseNotes(notes)).toEqual([{ kind: "paragraph", text: notes }]);
  });

  it("adjacent items collect into ONE list, not several in a row", () => {
    const blocks = parseNotes("- first\n- second\n- third");
    expect(blocks).toEqual([{ kind: "list", items: ["first", "second", "third"] }]);
  });

  it("a heading separates two lists", () => {
    const blocks = parseNotes("# Videos\n- one\n# Everything else\n- two");
    expect(blocks).toEqual([
      { kind: "heading", text: "Videos" },
      { kind: "list", items: ["one"] },
      { kind: "heading", text: "Everything else" },
      { kind: "list", items: ["two"] },
    ]);
  });

  it("a paragraph before a list is not swallowed", () => {
    const blocks = parseNotes("The short version.\n- an item");
    expect(blocks).toEqual([
      { kind: "paragraph", text: "The short version." },
      { kind: "list", items: ["an item"] },
    ]);
  });

  it("lines of one paragraph join up; a blank line starts a new one", () => {
    const blocks = parseNotes("first line\nsecond line\n\na new paragraph");
    expect(blocks).toEqual([
      { kind: "paragraph", text: "first line second line" },
      { kind: "paragraph", text: "a new paragraph" },
    ]);
  });

  it("a list after a paragraph and a paragraph after a list do not mix", () => {
    const blocks = parseNotes("- an item\ntail after the list");
    expect(blocks).toEqual([
      { kind: "list", items: ["an item"] },
      { kind: "paragraph", text: "tail after the list" },
    ]);
  });

  it("empty notes do not break the parser — the window says there is no description", () => {
    expect(parseNotes("")).toEqual([]);
    expect(parseNotes("   \n\n  ")).toEqual([]);
  });

  it("the “•” and “*” bullets work the same as a hyphen", () => {
    expect(parseNotes("• one\n* two")).toEqual([{ kind: "list", items: ["one", "two"] }]);
  });

  it("a real set of notes parses into headings and lists", () => {
    const blocks = parseNotes(
      [
        "Aurora 1.2.1 — six more videos.",
        "",
        "# Training videos",
        "- Six more protocols now carry a video.",
        "- Taking in a newcomer is one film again, not three parts.",
        "",
        "# Small things",
        "- The top bar no longer shudders on a short article.",
      ].join("\n"),
    );
    expect(blocks.map((b) => b.kind)).toEqual(["paragraph", "heading", "list", "heading", "list"]);
    expect(blocks[2]).toEqual({
      kind: "list",
      items: [
        "Six more protocols now carry a video.",
        "Taking in a newcomer is one film again, not three parts.",
      ],
    });
  });
});
