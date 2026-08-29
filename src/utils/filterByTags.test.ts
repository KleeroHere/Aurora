import { describe, expect, it } from "vitest";
import { filterMaterialsByTags } from "./filterByTags";

interface Item {
  id: string;
  tags: string[];
}

const items: Item[] = [
  { id: "a", tags: ["#therapy", "#chores"] },
  { id: "b", tags: ["#therapy"] },
  { id: "c", tags: ["#crisis", "#therapy", "#chores"] },
  { id: "d", tags: [] },
];

describe("filterMaterialsByTags", () => {
  it("AND logic - a material stays only when it carries ALL selected tags", () => {
    const result = filterMaterialsByTags(items, ["#therapy", "#chores"]);
    expect(result.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("a single tag behaves like a plain inclusion filter", () => {
    const result = filterMaterialsByTags(items, ["#crisis"]);
    expect(result.map((i) => i.id)).toEqual(["c"]);
  });

  it("empty result when no material carries all selected tags at once", () => {
    const result = filterMaterialsByTags(items, ["#crisis", "#chores", "#nonexistent"]);
    expect(result).toEqual([]);
  });

  it("reset - an empty list of active tags returns the original list unchanged", () => {
    expect(filterMaterialsByTags(items, [])).toBe(items);
  });
});
