import { describe, expect, it } from "vitest";
import {
  buildAppMaterialId,
  buildMigratedMaterialId,
  buildSectionId,
  generateShortId,
  sectionSlugFromId,
  slugify,
} from "./slug";

describe("buildMigratedMaterialId: determinism", () => {
  it("identical inputs always yield the same id (needed for an idempotent migration re-run)", () => {
    const a = buildMigratedMaterialId("article", "lekcii", "shag-1");
    const b = buildMigratedMaterialId("article", "lekcii", "shag-1");
    expect(a).toBe(b);
    expect(a).toBe("article:lekcii__shag-1");
  });

  it("different types/sections/names yield different ids", () => {
    const ids = new Set([
      buildMigratedMaterialId("article", "lekcii", "shag-1"),
      buildMigratedMaterialId("form", "lekcii", "shag-1"),
      buildMigratedMaterialId("article", "dnevniki", "shag-1"),
      buildMigratedMaterialId("article", "lekcii", "shag-2"),
    ]);
    expect(ids.size).toBe(4);
  });

});

describe("FINDING: slug collision (section 2.2) — buildMigratedMaterialId does not resolve collisions itself", () => {
  it("two DIFFERENT source files transliterating into the same slug yield the SAME migrated id", () => {
    const idFromFileA = buildMigratedMaterialId("article", "lekcii", slugify("Шаг 1"));
    const idFromFileB = buildMigratedMaterialId("article", "lekcii", slugify("Шаг-1"));
    expect(idFromFileA).toBe(idFromFileB);
  });
});

describe("buildAppMaterialId: shortid uniqueness", () => {
  it("the same title yields DIFFERENT ids on each call (the random tail is intentional; unusable for seed idempotency)", () => {
    const a = buildAppMaterialId("article", "lekcii", "Одна и та же статья");
    const b = buildAppMaterialId("article", "lekcii", "Одна и та же статья");
    expect(a).not.toBe(b);
    expect(a.startsWith("article:lekcii__odna-i-ta-zhe-statya-")).toBe(true);
    expect(b.startsWith("article:lekcii__odna-i-ta-zhe-statya-")).toBe(true);
  });

  it("500 consecutive calls with the same title yield no duplicate ids (shortid stress test)", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 500; i++) {
      ids.add(buildAppMaterialId("article", "lekcii", "Стресс-тест"));
    }
    expect(ids.size).toBe(500);
  });

  it("generateShortId() — exactly 6 characters, only [a-z0-9] (lowercase Crockford base32)", () => {
    for (let i = 0; i < 50; i++) {
      const shortId = generateShortId();
      expect(shortId).toHaveLength(6);
      expect(shortId).toMatch(/^[a-z0-9]{6}$/);
    }
  });
});

describe("slugify / buildSectionId / sectionSlugFromId", () => {
  it("slugify strips everything but [a-z0-9], collapses and trims dashes", () => {
    expect(slugify("Задание №1: «Мои мечты»")).toBe("zadanie-1-moi-mechty");
    expect(slugify("  --Пробелы и дефисы--  ")).toBe("probely-i-defisy");
  });

  it("slugify of an empty string yields an empty string (edge case)", () => {
    expect(slugify("")).toBe("");
    expect(slugify("---")).toBe("");
  });

  it("sectionSlugFromId(buildSectionId(x)) === x — reversibility (createMaterial needs it for app-created ids)", () => {
    expect(sectionSlugFromId(buildSectionId("lekcii"))).toBe("lekcii");
  });
});
