import { describe, expect, it } from "vitest";
import { fnv1a32, mulberry32, seededRandom } from "./seededRandom";

describe("fnv1a32", () => {
  it("deterministic - one string always yields one number", () => {
    expect(fnv1a32("article:test__test")).toBe(fnv1a32("article:test__test"));
  });

  it("different strings yield different hashes (in the vast majority of cases)", () => {
    expect(fnv1a32("a")).not.toBe(fnv1a32("b"));
  });

  it("returns a non-negative 32-bit number, non-ASCII input included", () => {
    const h = fnv1a32("any string with non-ASCII: déjà vu ✓");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("mulberry32", () => {
  it("one seed -> the same sequence", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("different seeds -> different sequences", () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toBe(b);
  });

  it("values within [0, 1)", () => {
    const rand = mulberry32(123);
    for (let i = 0; i < 50; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("seededRandom", () => {
  it("same key -> same sequence", () => {
    const a = seededRandom("section:lektsii");
    const b = seededRandom("section:lektsii");
    expect(a()).toBe(b());
  });

  it("different keys -> different sequences (adjacent routes get a different background pattern)", () => {
    const a = seededRandom("/section/lektsii");
    const b = seededRandom("/section/dnevniki");
    expect(a()).not.toBe(b());
  });
});
