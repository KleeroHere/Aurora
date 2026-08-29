import { describe, expect, it } from "vitest";

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorMix(a: Rgb, aPercent: number, b: Rgb): Rgb {
  const t = aPercent / 100;
  return [
    a[0] * t + b[0] * (1 - t),
    a[1] * t + b[1] * (1 - t),
    a[2] * t + b[2] * (1 - t),
  ];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE: Rgb = [255, 255, 255];

/** --brand-veil and --color-surface of every palette, dark lightness. */
const DARK_SELECTION: [string, string, string][] = [
  ["base layer", "#3f3f3f", "#161616"],
  ["aurora", "#271f4f", "#161c2e"],
  ["clinic", "#16383a", "#162423"],
  ["nightshift", "#24201a", "#1c1917"],
];

/** --color-accent, --color-surface and --color-text-primary, light lightness. */
const LIGHT_SELECTION: [string, string, string, string][] = [
  ["base layer", "#d6543f", "#ffffff", "#111111"],
  ["aurora", "#054bb3", "#ffffff", "#1a1d29"],
  ["clinic", "#0e6a66", "#ffffff", "#12211f"],
  ["nightshift", "#8a5512", "#fbf6ee", "#241f19"],
];

describe("::selection - dark scheme: opaque fill over the surface, white text", () => {
  for (const [name, veil, surface] of DARK_SELECTION) {
    it(`${name}: 65% ${veil} in ${surface}`, () => {
      const background = colorMix(hexToRgb(veil), 65, hexToRgb(surface));
      expect(contrastRatio(background, WHITE)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("::selection - light scheme: --color-active (accent-soft) under the primary text", () => {
  for (const [name, accent, surface, text] of LIGHT_SELECTION) {
    it(`${name}: accent-soft (12% ${accent} in ${surface}) on text ${text}`, () => {
      const background = colorMix(hexToRgb(accent), 12, hexToRgb(surface));
      expect(contrastRatio(background, hexToRgb(text))).toBeGreaterThanOrEqual(4.5);
    });
  }
});
