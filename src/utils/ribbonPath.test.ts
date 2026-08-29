import { describe, expect, it } from "vitest";
import {
  CANVAS_SIZE,
  ENVELOPE_RADIUS,
  buildBraidStrandPoints,
  buildKnotStrandPath,
  buildSpiralStrandPoints,
  drawOrderFromWeave,
  pointsToPath,
  sliceOverlappingSegments,
} from "./ribbonPath";

describe("drawOrderFromWeave", () => {
  it("always a permutation of [0,1,2] regardless of input", () => {
    for (let weave = 0; weave <= 7; weave++) {
      const order = drawOrderFromWeave(weave);
      expect([...order].sort()).toEqual([0, 1, 2]);
    }
  });

  it("deterministic - one weave always yields one order", () => {
    expect(drawOrderFromWeave(3)).toEqual(drawOrderFromWeave(3));
  });

  it("stays a permutation for weave+braid-segment too (may exceed 0..7)", () => {
    for (let weave = 5; weave < 5 + 6; weave++) {
      expect([...drawOrderFromWeave(weave)].sort()).toEqual([0, 1, 2]);
    }
  });
});

describe("buildKnotStrandPath (the \"knot\" archetype)", () => {
  it("deterministic - the same parameters yield the same path", () => {
    const a = buildKnotStrandPath(0.5, 0.5, 40, 0.4);
    const b = buildKnotStrandPath(0.5, 0.5, 40, 0.4);
    expect(a).toBe(b);
  });

  it("the path passes through the node (the shared junction point of the two segments)", () => {
    const path = buildKnotStrandPath(0.5, 0.48, 90, 0.5);
    const nodeX = 0.5 * CANVAS_SIZE;
    const nodeY = 0.48 * CANVAS_SIZE;
    expect(path).toContain(`${nodeX} ${nodeY}`);
  });

  it("a different angle yields a different path", () => {
    const a = buildKnotStrandPath(0.5, 0.5, 10, 0.4);
    const b = buildKnotStrandPath(0.5, 0.5, 200, 0.4);
    expect(a).not.toBe(b);
  });

  it("starts with M and contains two cubic C segments", () => {
    const path = buildKnotStrandPath(0.5, 0.5, 0, 0.3);
    expect(path.startsWith("M ")).toBe(true);
    expect(path.match(/C /g)).toHaveLength(2);
  });
});

describe("pointsToPath (Catmull-Rom -> cubic Bezier, the \"braid\"/\"spiral\" archetypes)", () => {
  it("empty array -> empty string", () => {
    expect(pointsToPath([])).toBe("");
  });

  it("a single point -> a path without curves", () => {
    expect(pointsToPath([{ x: 10, y: 20 }])).toBe("M 10 20");
  });

  it("several points -> M plus one C segment per pair of adjacent points", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
      { x: 30, y: 10 },
    ];
    const path = pointsToPath(points);
    expect(path.startsWith("M 0 0")).toBe(true);
    expect(path.match(/C /g)).toHaveLength(3);
  });

  it("deterministic - the same points yield the same path", () => {
    const points = [
      { x: 1, y: 1 },
      { x: 5, y: 9 },
      { x: 12, y: 4 },
    ];
    expect(pointsToPath(points)).toBe(pointsToPath(points));
  });
});

describe("sliceOverlappingSegments (slicing a \"braid\" strand to alternate draw order)", () => {
  const points = Array.from({ length: 41 }, (_, i) => ({ x: i, y: i * 2 }));

  it("splits into the requested number of segments", () => {
    expect(sliceOverlappingSegments(points, 4)).toHaveLength(4);
    expect(sliceOverlappingSegments(points, 5)).toHaveLength(5);
  });

  it("adjacent segments share the boundary point - no gap at the seam", () => {
    const segments = sliceOverlappingSegments(points, 5);
    for (let i = 0; i < segments.length - 1; i++) {
      expect(segments[i][segments[i].length - 1]).toEqual(segments[i + 1][0]);
    }
  });
});

describe("buildBraidStrandPoints (the \"braid\" archetype)", () => {
  it("deterministic", () => {
    expect(buildBraidStrandPoints(0, 3, 0.4)).toEqual(buildBraidStrandPoints(0, 3, 0.4));
  });

  it("three strands on the same stretch - different trajectories (120/240 degree phase shift)", () => {
    const a = buildBraidStrandPoints(0, 3, 0.4);
    const b = buildBraidStrandPoints(1, 3, 0.4);
    const c = buildBraidStrandPoints(2, 3, 0.4);
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
    expect(b).not.toEqual(c);
  });

  it("stays within the central area of the canvas at maximum amplitude", () => {
    for (const strandIndex of [0, 1, 2] as const) {
      const points = buildBraidStrandPoints(strandIndex, 4, 0.84);
      for (const p of points) {
        expect(p.x).toBeGreaterThan(-20);
        expect(p.x).toBeLessThan(CANVAS_SIZE + 20);
        expect(p.y).toBeGreaterThan(-20);
        expect(p.y).toBeLessThan(CANVAS_SIZE + 20);
      }
    }
  });
});

describe("buildSpiralStrandPoints (the \"spiral\" archetype)", () => {
  it("deterministic", () => {
    expect(buildSpiralStrandPoints(30, 1.5, 0.4)).toEqual(buildSpiralStrandPoints(30, 1.5, 0.4));
  });

  it("does not collapse into a single point - the starting radius is noticeably above zero", () => {
    const [start] = buildSpiralStrandPoints(0, 1.5, 0.4);
    const center = CANVAS_SIZE / 2;
    const dist = Math.hypot(start.x - center, start.y - center);
    expect(dist).toBeGreaterThan(5);
  });

  it("fits within the central-70% envelope (acceptance criterion P5 s.1.2 \"Geometric guarantees\")", () => {
    const center = CANVAS_SIZE / 2;
    for (const angle of [0, 90, 180, 270]) {
      const points = buildSpiralStrandPoints(angle, 2.4, 0.84);
      for (const p of points) {
        const dist = Math.hypot(p.x - center, p.y - center);
        expect(dist).toBeLessThanOrEqual(ENVELOPE_RADIUS + 1);
      }
    }
  });
});
