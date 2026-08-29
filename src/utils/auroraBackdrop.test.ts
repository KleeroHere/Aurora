import { describe, expect, it } from "vitest";
import { computeBackdropVars } from "./auroraBackdrop";

describe("computeBackdropVars", () => {
  it("returns four blobs (x/y/size/color) for a seed", () => {
    const vars = computeBackdropVars("/section/lectures", 18) as Record<string, string>;
    for (let i = 1; i <= 4; i++) {
      expect(vars[`--bg-blob-${i}-x`]).toMatch(/^\d+%$/);
      expect(vars[`--bg-blob-${i}-y`]).toMatch(/^\d+%$/);
      expect(vars[`--bg-blob-${i}-size`]).toMatch(/^\d+%$/);
      expect(vars[`--bg-blob-${i}-color`]).toContain("color-mix");
    }
  });

  it("P13: each blob gravitates to its own corner (0/100 on x and y within the jitter)", () => {
    const vars = computeBackdropVars("/section/corners", 18) as Record<string, string>;
    const corners = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ];
    corners.forEach((corner, idx) => {
      const i = idx + 1;
      const x = Number(vars[`--bg-blob-${i}-x`].replace("%", ""));
      const y = Number(vars[`--bg-blob-${i}-y`].replace("%", ""));
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(Math.abs(x - corner.x)).toBeLessThanOrEqual(14);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
      expect(Math.abs(y - corner.y)).toBeLessThanOrEqual(14);
    });
  });

  it("P13: blob size is large and noticeable (54-84%, not the former 45-65%) but does not flood the whole screen", () => {
    const vars = computeBackdropVars("/material/big-blob-check", 18) as Record<string, string>;
    for (let i = 1; i <= 4; i++) {
      const size = Number(vars[`--bg-blob-${i}-size`].replace("%", ""));
      expect(size).toBeGreaterThanOrEqual(54);
      expect(size).toBeLessThanOrEqual(84);
    }
  });

  it("same seedKey -> identical set of variables", () => {
    const a = computeBackdropVars("/material/x", 18);
    const b = computeBackdropVars("/material/x", 18);
    expect(a).toEqual(b);
  });

  it("different seedKeys -> different blob positions", () => {
    const a = computeBackdropVars("/section/a", 18) as Record<string, string>;
    const b = computeBackdropVars("/section/b", 18) as Record<string, string>;
    expect(a["--bg-blob-1-x"]).not.toBe(b["--bg-blob-1-x"]);
  });

  it("opacity is baked into color-mix from the percent argument", () => {
    const vars = computeBackdropVars("seed", 42) as Record<string, string>;
    expect(vars["--bg-blob-1-color"]).toContain("42%");
  });
});
