import { computeGlyphParams } from "./glyphParams";
import type { GlyphColorKey, GlyphParams } from "./glyphParams";
import { CANVAS_SIZE } from "./ribbonPath";
import type { Point } from "./ribbonPath";
import type { CardColor } from "../data/types";

const cache = new Map<string, string>();

function readColor(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || "#000000";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  let h = match[1];
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
}

function themeSignature(): string {
  const root = document.documentElement;
  return `${root.getAttribute("data-theme")}:${root.getAttribute("data-scheme")}`;
}

export function glyphCacheKey(materialId: string, cardColor: CardColor | null | undefined): string {
  return `${materialId}:${cardColor ?? "neutral"}:${themeSignature()}`;
}

function drawBackground(ctx: CanvasRenderingContext2D, params: GlyphParams, baseColor: string): void {
  const cx = params.nodeX * CANVAS_SIZE;
  const cy = params.nodeY * CANVAS_SIZE;
  const light = lighten(baseColor, 0.24);

  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, CANVAS_SIZE * 0.75);
  glow.addColorStop(0, light);
  glow.addColorStop(1, baseColor);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const vignette = ctx.createRadialGradient(
    CANVAS_SIZE / 2,
    CANVAS_SIZE / 2,
    CANVAS_SIZE * 0.32,
    CANVAS_SIZE / 2,
    CANVAS_SIZE / 2,
    CANVAS_SIZE * 0.72,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

const BAND_SAMPLE_COUNT = 48;
const MIN_BAND_COUNT = 3;
const MAX_BAND_COUNT = 8; // inclusive -> 6 possible values

function resolveBandCount(params: GlyphParams): number {
  return MIN_BAND_COUNT + (params.seed % (MAX_BAND_COUNT - MIN_BAND_COUNT + 1));
}

function buildAuroraBandPoints(params: GlyphParams, bandIndex: number, bandCount: number): Point[] {
  const phase = (params.angles[bandIndex % 3] * Math.PI) / 180 + bandIndex;
  const amplitude = CANVAS_SIZE * (0.035 + params.curl * 0.045);
  const frequency = 1 + (bandIndex % 3) * 0.3;
  const spacing = CANVAS_SIZE / (bandCount + 1);
  const baseY = spacing * (bandIndex + 1) + (params.nodeY - 0.5) * CANVAS_SIZE * 0.25;

  const points: Point[] = [];
  for (let i = 0; i <= BAND_SAMPLE_COUNT; i++) {
    const t = i / BAND_SAMPLE_COUNT;
    const x = t * CANVAS_SIZE;
    const taper = Math.sin(t * Math.PI); // 0 at the edges, 1 at mid-width
    const wave = Math.sin(t * Math.PI * frequency * 2 + phase) * amplitude * (0.4 + 0.6 * taper);
    points.push({ x, y: baseY + wave });
  }
  return points;
}

function bandPath(points: readonly Point[]): Path2D {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return new Path2D(d);
}

function strokeAuroraBand(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  colorKey: GlyphColorKey,
  baseWidth: number,
): void {
  const fromColor = readColor(`--glyph-pair-${colorKey}-from`);
  const toColor = readColor(`--glyph-pair-${colorKey}-to`);
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_SIZE, 0);
  gradient.addColorStop(0, fromColor);
  gradient.addColorStop(1, toColor);

  const layers = [
    { widthMul: 3.2, alpha: 0.14 },
    { widthMul: 2.1, alpha: 0.24 },
    { widthMul: 1.3, alpha: 0.42 },
    { widthMul: 0.7, alpha: 0.8 },
  ];
  ctx.strokeStyle = gradient;
  for (const layer of layers) {
    ctx.globalAlpha = layer.alpha;
    ctx.lineWidth = baseWidth * layer.widthMul;
    ctx.stroke(path);
  }
  ctx.globalAlpha = 1;
}

function drawAuroraCurtain(ctx: CanvasRenderingContext2D, params: GlyphParams): void {
  const bandCount = resolveBandCount(params);
  for (let idx = 0; idx < bandCount; idx++) {
    const strand = params.strands[idx % 3];
    const points = buildAuroraBandPoints(params, idx, bandCount);
    const path = bandPath(points);
    const baseWidth = 9 + (params.curl + (idx % 3) * 0.15) * 12;
    strokeAuroraBand(ctx, path, strand.colorKey, baseWidth);
  }
}

export function renderGlyphDataUrl(materialId: string, cardColor: CardColor | null | undefined): string {
  const key = glyphCacheKey(materialId, cardColor);
  const cached = cache.get(key);
  if (cached) return cached;

  const params = computeGlyphParams(materialId, cardColor);

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas.toDataURL("image/png");
  }

  const baseColor = readColor("--glyph-base-color");
  drawBackground(ctx, params, baseColor);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  drawAuroraCurtain(ctx, params);

  const dataUrl = canvas.toDataURL("image/webp", 0.85);
  cache.set(key, dataUrl);
  return dataUrl;
}
