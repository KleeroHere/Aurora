import { describe, expect, it } from "vitest";
import { computeGlyphParams, computeGlyphSeed, resolveGlyphColorKey, resolveStrandColorKeys } from "./glyphParams";

const GLYPH_COLOR_KEYS = ["blue", "purple", "green", "red", "pink"];

describe("computeGlyphSeed", () => {
  it("same id and color -> same seed", () => {
    expect(computeGlyphSeed("article:x__y", "blue")).toBe(computeGlyphSeed("article:x__y", "blue"));
  });

  it("changing card.color -> different seed (recolor regenerates the drawing)", () => {
    expect(computeGlyphSeed("article:x__y", "blue")).not.toBe(computeGlyphSeed("article:x__y", "red"));
  });

  it("a missing color is treated as 'neutral'", () => {
    expect(computeGlyphSeed("article:x__y", null)).toBe(computeGlyphSeed("article:x__y", "neutral"));
    expect(computeGlyphSeed("article:x__y", undefined)).toBe(computeGlyphSeed("article:x__y", "neutral"));
  });
});

describe("computeGlyphParams - determinism (P5, acceptance criterion)", () => {
  it("the same material -> identical params (survives restart/transfer)", () => {
    const a = computeGlyphParams("article:lektsii__moya-statya", "blue");
    const b = computeGlyphParams("article:lektsii__moya-statya", "blue");
    expect(a).toEqual(b);
  });

  it("changing card.color changes the glyph params", () => {
    const a = computeGlyphParams("article:lektsii__moya-statya", "blue");
    const b = computeGlyphParams("article:lektsii__moya-statya", "red");
    expect(a).not.toEqual(b);
  });

  it("the convergence node (composition anchor point) is always within the central 60% of the canvas (0.38..0.62 on both axes)", () => {
    for (let i = 0; i < 200; i++) {
      const { nodeX, nodeY } = computeGlyphParams(`material:${i}`, "neutral");
      expect(nodeX).toBeGreaterThanOrEqual(0.38);
      expect(nodeX).toBeLessThanOrEqual(0.62);
      expect(nodeY).toBeGreaterThanOrEqual(0.38);
      expect(nodeY).toBeLessThanOrEqual(0.62);
    }
  });

  it("curl within 0.25..0.84", () => {
    for (let i = 0; i < 200; i++) {
      const { curl } = computeGlyphParams(`material:${i}`, "purple");
      expect(curl).toBeGreaterThanOrEqual(0.25);
      expect(curl).toBeLessThanOrEqual(0.84);
    }
  });

  it("weave within 0..7", () => {
    for (let i = 0; i < 200; i++) {
      const { weave } = computeGlyphParams(`material:${i}`, "green");
      expect(weave).toBeGreaterThanOrEqual(0);
      expect(weave).toBeLessThanOrEqual(7);
    }
  });

  it("minimum pairwise angular gap of 45 degrees over a sample of 500 random ids (acceptance criterion U6.2, kept from v1)", () => {
    for (let i = 0; i < 500; i++) {
      const { angles } = computeGlyphParams(`material:random-${i}-${Math.random()}`, "pink");
      const [a, b, c] = angles;
      const gap = (x: number, y: number) => {
        const diff = Math.abs(x - y) % 360;
        return diff > 180 ? 360 - diff : diff;
      };
      expect(gap(a, b)).toBeGreaterThanOrEqual(45);
      expect(gap(a, c)).toBeGreaterThanOrEqual(45);
      expect(gap(b, c)).toBeGreaterThanOrEqual(45);
    }
  });

  it("all angles normalized into [0, 360)", () => {
    for (let i = 0; i < 200; i++) {
      const { angles } = computeGlyphParams(`material:${i}`, "blue");
      for (const angle of angles) {
        expect(angle).toBeGreaterThanOrEqual(0);
        expect(angle).toBeLessThan(360);
      }
    }
  });
});

describe("computeGlyphParams - composition archetype (P5 s.1.2 \"Three composition archetypes\")", () => {
  it("one of three: knot/braid/spiral", () => {
    for (let i = 0; i < 200; i++) {
      const { archetype } = computeGlyphParams(`material:${i}`, "neutral");
      expect(["knot", "braid", "spiral"]).toContain(archetype);
    }
  });

  it("deterministic - the same material yields the same archetype", () => {
    const a = computeGlyphParams("article:a__b", "green").archetype;
    const b = computeGlyphParams("article:a__b", "green").archetype;
    expect(a).toBe(b);
  });

  it("a large sample shows all three archetypes (does not degenerate into one)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seen.add(computeGlyphParams(`material:variety-${i}`, "neutral").archetype);
    }
    expect(seen.size).toBe(3);
  });

  it("braidCrossings - 3 or 4 (s.1.2 \"Braid\": \"at three or four points\")", () => {
    for (let i = 0; i < 200; i++) {
      const { braidCrossings } = computeGlyphParams(`material:${i}`, "red");
      expect([3, 4]).toContain(braidCrossings);
    }
  });
});

describe("computeGlyphParams - strands (P5 s.1.2 \"A strand instead of a ribbon\")", () => {
  it("three strands, each with 4-6 filaments 0.8..2.2 thick (instead of the fixed 34/27/21 triple from v1)", () => {
    for (let i = 0; i < 100; i++) {
      const { strands } = computeGlyphParams(`material:${i}`, "neutral");
      expect(strands).toHaveLength(3);
      for (const strand of strands) {
        expect(strand.filaments.length).toBeGreaterThanOrEqual(4);
        expect(strand.filaments.length).toBeLessThanOrEqual(6);
        for (const filament of strand.filaments) {
          expect(filament.thickness).toBeGreaterThanOrEqual(0.8);
          expect(filament.thickness).toBeLessThanOrEqual(2.2);
        }
      }
    }
  });

  it("total visual mass of a strand within a reasonable 4..14 (spec guideline is 6-10)", () => {
    for (let i = 0; i < 100; i++) {
      const { strands } = computeGlyphParams(`material:${i}`, "neutral");
      for (const strand of strands) {
        const mass = strand.filaments.reduce((sum, f) => sum + f.thickness, 0);
        expect(mass).toBeGreaterThanOrEqual(4);
        expect(mass).toBeLessThanOrEqual(14);
      }
    }
  });
});

describe("computeGlyphParams - depth layer (P5 s.1.2 \"Depth layer\")", () => {
  it("5-8 companion filaments with opacity 0.15..0.25 and thickness 0.4..0.6", () => {
    for (let i = 0; i < 100; i++) {
      const { depthFilaments } = computeGlyphParams(`material:${i}`, "neutral");
      expect(depthFilaments.length).toBeGreaterThanOrEqual(5);
      expect(depthFilaments.length).toBeLessThanOrEqual(8);
      for (const filament of depthFilaments) {
        expect(filament.opacity).toBeGreaterThanOrEqual(0.15);
        expect(filament.opacity).toBeLessThanOrEqual(0.25);
        expect(filament.thickness).toBeGreaterThanOrEqual(0.4);
        expect(filament.thickness).toBeLessThanOrEqual(0.6);
        expect([0, 1, 2]).toContain(filament.strandIndex);
      }
    }
  });
});

describe("resolveStrandColorKeys (P5 s.1.2 \"Color\" - every strand has its own pair)", () => {
  it("returns three valid palette keys", () => {
    for (let i = 0; i < 100; i++) {
      const keys = resolveStrandColorKeys(`material:${i}`, "neutral");
      expect(keys).toHaveLength(3);
      for (const key of keys) {
        expect(GLYPH_COLOR_KEYS).toContain(key);
      }
    }
  });

  it("with an explicit card.color the first strand takes the pair pinned to that color", () => {
    const [first] = resolveStrandColorKeys("article:x__y", "purple");
    expect(first).toBe("purple");
  });

  it("the first strand matches resolveGlyphColorKey (single source of truth for a material's \"primary\" color)", () => {
    for (let i = 0; i < 50; i++) {
      const [first] = resolveStrandColorKeys(`material:${i}`, "neutral");
      expect(first).toBe(resolveGlyphColorKey(`material:${i}`, "neutral"));
    }
  });

  it("deterministic - the same material/color yields the same set of pairs", () => {
    const a = resolveStrandColorKeys("article:a__b", "neutral");
    const b = resolveStrandColorKeys("article:a__b", "neutral");
    expect(a).toEqual(b);
  });

  it("across a sample of neutral materials the second/third strand pairs do not always degenerate into the same value", () => {
    const seconds = new Set<string>();
    const thirds = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const [, second, third] = resolveStrandColorKeys(`material:variety-${i}`, "neutral");
      seconds.add(second);
      thirds.add(third);
    }
    expect(seconds.size).toBeGreaterThan(1);
    expect(thirds.size).toBeGreaterThan(1);
  });
});
