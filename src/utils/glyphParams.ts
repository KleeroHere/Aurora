import { fnv1a32 } from "./seededRandom";

function subSeed(seed: number, salt: string): number {
  return fnv1a32(`${seed}:${salt}`);
}

const MIN_ANGLE_GAP = 45;
const ANGLE_BUMP_STEP = 15;

export type GlyphArchetype = "knot" | "braid" | "spiral";
const ARCHETYPES: readonly GlyphArchetype[] = ["knot", "braid", "spiral"];

export interface FilamentGeometry {
  thickness: number;
  offsetAngle: number;
  offsetRadius: number;
}

export interface StrandParams {
  colorKey: GlyphColorKey;
  filaments: FilamentGeometry[];
  turns: number;
}

export interface DepthFilament {
  strandIndex: 0 | 1 | 2;
  thickness: number;
  opacity: number;
  offsetAngle: number;
  offsetRadius: number;
}

export interface GlyphParams {
  seed: number;
  archetype: GlyphArchetype;
  nodeX: number; // 0.38..0.62 - fraction of canvas width (the "knot" archetype and the composition anchor point)
  nodeY: number; // 0.38..0.62 - fraction of canvas height
  angles: [number, number, number];
  curl: number; // 0.25..0.84
  weave: number; // 0..7 - overlap order when drawing (knot/spiral - for the whole glyph, braid - per segment)
  braidCrossings: number;
  strands: [StrandParams, StrandParams, StrandParams];
  depthFilaments: DepthFilament[];
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function angularGap(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function enforceMinimumAngleGap(angles: [number, number, number]): [number, number, number] {
  const result: [number, number, number] = [...angles];
  const pairs: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 2],
  ];

  for (let iteration = 0; iteration < 24; iteration++) {
    let violated = false;
    for (const [i, j] of pairs) {
      if (angularGap(result[i], result[j]) < MIN_ANGLE_GAP) {
        violated = true;
        const smaller = result[i] <= result[j] ? i : j;
        result[smaller] = normalizeAngle(result[smaller] + ANGLE_BUMP_STEP);
      }
    }
    if (!violated) break;
  }

  return result;
}

export function computeGlyphSeed(materialId: string, cardColor: string | null | undefined): number {
  return fnv1a32(`${materialId}:${cardColor || "neutral"}`);
}

const GLYPH_COLOR_KEYS = ["blue", "purple", "green", "red", "pink"] as const;
export type GlyphColorKey = (typeof GLYPH_COLOR_KEYS)[number];

export function resolveGlyphColorKey(materialId: string, cardColor: string | null | undefined): GlyphColorKey {
  if (cardColor && cardColor !== "neutral" && (GLYPH_COLOR_KEYS as readonly string[]).includes(cardColor)) {
    return cardColor as GlyphColorKey;
  }
  const seed = computeGlyphSeed(materialId, cardColor);
  return GLYPH_COLOR_KEYS[seed % GLYPH_COLOR_KEYS.length];
}

export function resolveStrandColorKeys(
  materialId: string,
  cardColor: string | null | undefined,
): [GlyphColorKey, GlyphColorKey, GlyphColorKey] {
  const seed = computeGlyphSeed(materialId, cardColor);
  const first = resolveGlyphColorKey(materialId, cardColor);
  const second = GLYPH_COLOR_KEYS[(seed >>> 7) % GLYPH_COLOR_KEYS.length];
  const third = GLYPH_COLOR_KEYS[(seed >>> 17) % GLYPH_COLOR_KEYS.length];
  return [first, second, third];
}

function buildFilaments(seed: number, strandIndex: number): FilamentGeometry[] {
  const strandSeed = subSeed(seed, `strand${strandIndex}`);
  const count = 4 + (strandSeed % 3); // 4..6, "filament count per strand comes from the seed, different across strands"
  const filaments: FilamentGeometry[] = [];
  for (let j = 0; j < count; j++) {
    const filamentSeed = subSeed(strandSeed, `filament${j}`);
    const thickness = (8 + ((filamentSeed >>> 4) % 15)) / 10; // 0.8..2.2 (divided in one go - adding 0.8+0.x floats at the 2.2 boundary)
    const offsetAngle = (filamentSeed >>> 9) % 360;
    const offsetRadius = ((filamentSeed >>> 18) % 21) / 10; // 0..2.0 - a slight spread, "like a bundle"
    filaments.push({ thickness, offsetAngle, offsetRadius });
  }
  return filaments;
}

function buildStrand(seed: number, strandIndex: number, colorKey: GlyphColorKey): StrandParams {
  const strandSeed = subSeed(seed, `strand${strandIndex}`);
  const turns = (11 + ((strandSeed >>> 22) % 14)) / 10; // 1.1..2.4 turns (the "spiral" archetype only)
  return { colorKey, filaments: buildFilaments(seed, strandIndex), turns };
}

function buildDepthFilaments(seed: number): DepthFilament[] {
  const depthSeed = subSeed(seed, "depth");
  const count = 5 + (depthSeed % 4); // 5..8
  const result: DepthFilament[] = [];
  for (let i = 0; i < count; i++) {
    const filamentSeed = subSeed(depthSeed, `d${i}`);
    result.push({
      strandIndex: (i % 3) as 0 | 1 | 2,
      thickness: (4 + ((filamentSeed >>> 3) % 3)) / 10, // 0.4..0.6 (see the filament thickness comment above - addition floats at the boundary)
      opacity: (15 + ((filamentSeed >>> 7) % 11)) / 100, // 0.15..0.25
      offsetAngle: (filamentSeed >>> 12) % 360,
      offsetRadius: 4 + ((filamentSeed >>> 20) % 7), // 4..10 - noticeably farther out than the main strand's bundle
    });
  }
  return result;
}

export function computeGlyphParams(materialId: string, cardColor: string | null | undefined): GlyphParams {
  const seed = computeGlyphSeed(materialId, cardColor);
  const archetype = ARCHETYPES[(seed >>> 3) % 3];

  const nodeX = 0.5 + (((seed >>> 0) % 25) - 12) / 100;
  const nodeY = 0.5 + (((seed >>> 5) % 25) - 12) / 100;
  const baseAngle = (seed >>> 10) % 360;
  const curl = (25 + ((seed >>> 26) % 60)) / 100; // 0.25..0.84 (divided in one go - same reason as filament thickness)
  const weave = (seed >>> 20) & 7;
  const braidCrossings = 3 + (subSeed(seed, "crossings") % 2); // 3 or 4, "at three or four points"

  const rawAngles: [number, number, number] = [0, 1, 2].map((n) => {
    const jitter = ((seed >>> (13 + 4 * n)) % 50) - 25;
    return normalizeAngle(baseAngle + 120 * n + jitter);
  }) as [number, number, number];

  const angles = enforceMinimumAngleGap(rawAngles);

  const colorKeys = resolveStrandColorKeys(materialId, cardColor);
  const strands = [0, 1, 2].map((i) => buildStrand(seed, i, colorKeys[i])) as [
    StrandParams,
    StrandParams,
    StrandParams,
  ];
  const depthFilaments = buildDepthFilaments(seed);

  return { seed, archetype, nodeX, nodeY, angles, curl, weave, braidCrossings, strands, depthFilaments };
}
