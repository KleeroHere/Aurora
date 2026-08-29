import { describe, expect, it } from "vitest";
import { createMaterialSearchIndex } from "./searchIndex";
import type { MaterialSummary } from "./types";

function makeSummary(overrides: Partial<MaterialSummary> & { _id: string; title: string }): MaterialSummary {
  return {
    type: "article",
    sectionId: "section:test",
    tags: [],
    card: { color: "neutral", cover: null },
    order: 1,
    excerpt: null,
    updatedAt: new Date().toISOString(),
    readingTime: 1,
    file: null,
    video: null,
    ...overrides,
  };
}

describe("createMaterialSearchIndex: morphology (task 1.2)", () => {
  it("finds a document by a different word form of the same root", () => {
    const index = createMaterialSearchIndex();
    index.upsert(makeSummary({ _id: "article:a", title: "Cleaning schedule" }), "Text about the cleaned floors.");

    const hits = index.search("cleans");
    expect(hits.map((h) => h.summary._id)).toContain("article:a");
  });

  it("title and a body word form are found by one root in both directions", () => {
    const index = createMaterialSearchIndex();
    index.upsert(makeSummary({ _id: "article:b", title: "Heading" }), "Material about a category and categories.");

    expect(index.search("category").map((h) => h.summary._id)).toContain("article:b");
    expect(index.search("categories").map((h) => h.summary._id)).toContain("article:b");
  });
});

describe("createMaterialSearchIndex: typos by word length (task 1.3)", () => {
  it("a short word (<=3) does not fuzzily match another short word", () => {
    const index = createMaterialSearchIndex();
    index.upsert(makeSummary({ _id: "article:short", title: "cat" }), "");
    index.upsert(makeSummary({ _id: "article:other", title: "car" }), "");

    const hits = index.search("car");
    expect(hits.map((h) => h.summary._id)).not.toContain("article:short");
  });

  it("a 4-7 character word is found with a typo at distance 1", () => {
    const index = createMaterialSearchIndex();
    index.upsert(makeSummary({ _id: "article:typo", title: "cover" }), "");

    const hits = index.search("kover");
    expect(hits.map((h) => h.summary._id)).toContain("article:typo");
  });
});

describe("createMaterialSearchIndex: tag weight between title and body (task 3.4)", () => {
  it("a title match ranks above a body match", () => {
    const index = createMaterialSearchIndex();
    index.upsert(makeSummary({ _id: "article:title-hit", title: "Crisis management" }), "Ordinary text.");
    index.upsert(makeSummary({ _id: "article:body-hit", title: "Another article" }), "A crisis is mentioned here.");

    const hits = index.search("crisis");
    const order = hits.map((h) => h.summary._id);
    expect(order.indexOf("article:title-hit")).toBeLessThan(order.indexOf("article:body-hit"));
  });

  it("matchedFields names the matched field — title/body", () => {
    const index = createMaterialSearchIndex();
    index.upsert(makeSummary({ _id: "article:title-hit", title: "Crisis management" }), "Ordinary text.");
    index.upsert(makeSummary({ _id: "article:body-hit", title: "Another article" }), "A crisis is mentioned here.");
    index.upsert(
      makeSummary({ _id: "article:tag-hit", title: "Third article", tags: ["#crisis"] }),
      "Neutral text.",
    );

    const hits = index.search("crisis");
    const byId = new Map(hits.map((h) => [h.summary._id, h.matchedFields]));
    expect(byId.get("article:title-hit")).toContain("title");
    expect(byId.get("article:body-hit")).toContain("plainText");
    expect(byId.get("article:tag-hit")).toContain("tags");
  });
});

describe("createMaterialSearchIndex: synonyms (task 2)", () => {
  it("finds by alias a material with the canonical word; an exact hit ranks above a synonym hit", () => {
    const index = createMaterialSearchIndex();
    index.setSynonyms([{ canonical: "film", aliases: ["movie"] }]);
    index.upsert(makeSummary({ _id: "article:exact", title: "Movie night" }), "");
    index.upsert(makeSummary({ _id: "article:synonym", title: "Film catalog" }), "");

    const hits = index.search("movie");
    const order = hits.map((h) => h.summary._id);
    expect(order).toContain("article:exact");
    expect(order).toContain("article:synonym");
    expect(order.indexOf("article:exact")).toBeLessThan(order.indexOf("article:synonym"));
    expect(hits.find((h) => h.summary._id === "article:synonym")?.viaSynonym).toBe(true);
    expect(hits.find((h) => h.summary._id === "article:exact")?.viaSynonym).toBe(false);
  });

  it("a missing/reset synonym dictionary does not break regular search", () => {
    const index = createMaterialSearchIndex();
    index.upsert(makeSummary({ _id: "article:plain", title: "Ordinary article" }), "");
    index.setSynonyms(null);

    expect(index.search("ordinary").map((h) => h.summary._id)).toContain("article:plain");
  });
});

describe("createMaterialSearchIndex: suggestions (task 3.3)", () => {
  it("suggest offers a similar word when the index has one", () => {
    const index = createMaterialSearchIndex();
    index.upsert(makeSummary({ _id: "article:a", title: "Search tips" }), "");

    const suggestions = index.suggest("serch");
    expect(suggestions.some((s) => s.includes("search"))).toBe(true);
  });
});

describe("createMaterialSearchIndex: clear() (a bug found along the way)", () => {
  it("after clear() old documents no longer take part in search", () => {
    const index = createMaterialSearchIndex();
    index.upsert(makeSummary({ _id: "article:a", title: "Singular word" }), "");
    index.clear();

    expect(index.search("Singular")).toHaveLength(0);
    expect(() => index.upsert(makeSummary({ _id: "article:a", title: "Singular word" }), "")).not.toThrow();
  });
});
