import { describe, expect, it } from "vitest";
import { CANONICAL_TAG_ORDER, orderTagsForDisplay, tagColorVar } from "./tagColor";

describe("tagColorVar", () => {
  it("the six canonical groups take a color from a palette slot", () => {
    for (const tag of CANONICAL_TAG_ORDER) {
      expect(tagColorVar(tag), tag).toMatch(/^var\(--tag-[1-6]\)$/);
    }
  });

  it("each canonical group has its own slot - groups are distinguishable", () => {
    const slots = CANONICAL_TAG_ORDER.map(tagColorVar);
    expect(new Set(slots).size).toBe(CANONICAL_TAG_ORDER.length);
  });

  it("an unknown (free) tag gets a neutral slot, not a canonical one", () => {
    expect(tagColorVar("#mytopic")).toMatch(/^var\(--tag-free-[1-3]\)$/);
  });

  it("deterministic - one tag always gets one color", () => {
    expect(tagColorVar("#mytopic")).toBe(tagColorVar("#mytopic"));
  });

  it("primaryTag (without #, same text as a canonical one) is also neutral - does not match the canonical smart-tag color", () => {
    expect(tagColorVar("therapy")).not.toBe(tagColorVar("#therapy"));
  });
});

describe("orderTagsForDisplay", () => {
  it("canonical tags first (in the fixed group order), then the rest, then primaryTag", () => {
    const tags = ["therapy", "#documents", "#crisis", "#mytag"];
    expect(orderTagsForDisplay(tags, "therapy")).toEqual(["#crisis", "#documents", "#mytag", "therapy"]);
  });

  it("without primaryTag - simply canonical first, then the rest", () => {
    expect(orderTagsForDisplay(["#chores", "#crisis", "#custom"])).toEqual(["#crisis", "#chores", "#custom"]);
  });

  it("a primaryTag absent from the tags is not added artificially", () => {
    expect(orderTagsForDisplay(["#crisis"], "therapy")).toEqual(["#crisis"]);
  });
});
