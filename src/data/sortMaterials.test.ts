import { describe, expect, it } from "vitest";
import { compareMaterials, naturalCompare } from "./sortMaterials";

interface Item {
  title: string;
  order?: number | null;
}

function sortedTitles(items: Item[]): string[] {
  return [...items].sort(compareMaterials).map((item) => item.title);
}

describe("compareMaterials: order is the only authority", () => {
  it("sorting goes by order, not by title", () => {
    const items: Item[] = [
      { title: "Zebra", order: 10 },
      { title: "Hedgehog", order: 20 },
      { title: "Awning", order: 5 },
      { title: "Step 10", order: 2 },
      { title: "Step 2", order: 1 },
    ];
    expect(sortedTitles(items)).toEqual(["Step 2", "Step 10", "Awning", "Zebra", "Hedgehog"]);
  });

  it("without order — natural sort by title", () => {
    const items: Item[] = [
      { title: "Zebra" },
      { title: "Hedgehog" },
      { title: "Awning" },
      { title: "Step 10" },
      { title: "Step 2" },
    ];
    expect(sortedTitles(items)).toEqual(["Awning", "Hedgehog", "Step 2", "Step 10", "Zebra"]);
  });

  it("Cyrillic titles: ICU collation order (yo between ye and zhe, diverging from code-point order)", () => {
    const items: Item[] = [
      { title: "Ящик" },
      { title: "Абажур" },
      { title: "Ёж" },
      { title: "Ежевика" },
    ];
    expect(sortedTitles(items)).toEqual(["Абажур", "Ёж", "Ежевика", "Ящик"]);
  });

  it("equal order — a consistent comparator in both directions", () => {
    const a: Item = { title: "Alpha", order: 5 };
    const b: Item = { title: "Beta", order: 5 };
    expect(compareMaterials(a, b)).toBeLessThan(0);
    expect(compareMaterials(b, a)).toBeGreaterThan(0);
  });

  it("order: 0 is a valid value, not lost as a missing order", () => {
    const a: Item = { title: "A", order: 0 };
    const b: Item = { title: "B" };
    expect(compareMaterials(a, b)).toBe(-1);
  });

  it("mixed list: materials with order come before materials without it", () => {
    const items: Item[] = [
      { title: "New B" },
      { title: "Old A", order: 1 },
      { title: "New A" },
      { title: "Old B", order: 2 },
    ];
    expect(sortedTitles(items)).toEqual(["Old A", "Old B", "New A", "New B"]);
  });
});

describe("naturalCompare: numeric segments as numbers", () => {
  it("Step 10 goes after Step 2 (not lexicographically)", () => {
    expect(sortedTitles([{ title: "Step 10" }, { title: "Step 2" }, { title: "Step 1" }])).toEqual([
      "Step 1",
      "Step 2",
      "Step 10",
    ]);
  });

  it("numbers at the start of the string", () => {
    expect(sortedTitles([{ title: "10. Summary" }, { title: "2. Introduction" }])).toEqual([
      "2. Introduction",
      "10. Summary",
    ]);
  });

  it("case insensitivity", () => {
    expect(sortedTitles([{ title: "step 2" }, { title: "Step 1" }])).toEqual(["Step 1", "step 2"]);
  });

  it("a number in the middle of the string", () => {
    expect(
      sortedTitles([{ title: "Form 10 appendix" }, { title: "Form 2 appendix" }]),
    ).toEqual(["Form 2 appendix", "Form 10 appendix"]);
  });

  it("empty strings and number-strings", () => {
    expect(sortedTitles([{ title: "10" }, { title: "" }, { title: "2" }, { title: "0" }])).toEqual(
      ["", "0", "2", "10"],
    );
  });

  it("leading zeros: '007' and '7' are equal as numbers", () => {
    expect(naturalCompare("007", "7")).toBe(0);
  });

  it("BigInt: comparing numbers above Number.MAX_SAFE_INTEGER without losing precision", () => {
    expect(
      naturalCompare(
        "Doc 90071992547409920002",
        "Doc 90071992547409920001",
      ),
    ).toBe(1);
  });
});
