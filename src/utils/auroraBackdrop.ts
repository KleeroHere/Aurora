import type { CSSProperties } from "react";
import { seededRandom } from "./seededRandom";

const BLOB_COLOR_VARS = [
  "var(--backdrop-blob-1)",
  "var(--backdrop-blob-2)",
  "var(--backdrop-blob-3)",
  "var(--backdrop-blob-4)",
  "var(--backdrop-blob-5)",
] as const;

const BLOB_COUNT = 4;

const CORNERS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 0, y: 100 },
  { x: 100, y: 100 },
];

const CORNER_JITTER = 14;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function computeBackdropVars(seedKey: string, opacityPercent: number): CSSProperties {
  const rand = seededRandom(seedKey);
  const vars: Record<string, string> = {};

  for (let i = 1; i <= BLOB_COUNT; i++) {
    const corner = CORNERS[(i - 1) % CORNERS.length];
    const jitterX = rand() * CORNER_JITTER * (corner.x === 0 ? 1 : -1);
    const jitterY = rand() * CORNER_JITTER * (corner.y === 0 ? 1 : -1);
    const x = clampPercent(corner.x + jitterX);
    const y = clampPercent(corner.y + jitterY);
    const size = 54 + Math.round(rand() * 30); // 54-84%
    const color = BLOB_COLOR_VARS[Math.floor(rand() * BLOB_COLOR_VARS.length)];
    vars[`--bg-blob-${i}-x`] = `${Math.round(x)}%`;
    vars[`--bg-blob-${i}-y`] = `${Math.round(y)}%`;
    vars[`--bg-blob-${i}-size`] = `${size}%`;
    vars[`--bg-blob-${i}-color`] = `color-mix(in srgb, ${color} ${opacityPercent}%, transparent)`;
  }

  return vars as CSSProperties;
}
