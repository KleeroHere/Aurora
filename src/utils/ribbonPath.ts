
export const CANVAS_SIZE = 300;
const CENTER: Point = { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };
export const ENVELOPE_RADIUS = CANVAS_SIZE * 0.35;

export interface Point {
  x: number;
  y: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function pointOnCircle(center: Point, radius: number, angleDeg: number): Point {
  const rad = toRad(angleDeg);
  return { x: center.x + radius * Math.cos(rad), y: center.y + radius * Math.sin(rad) };
}

function tangentUnit(angleDeg: number): Point {
  const rad = toRad(angleDeg);
  return { x: -Math.sin(rad), y: Math.cos(rad) };
}

export function pointOnEnvelope(angleDeg: number): Point {
  return pointOnCircle(CENTER, ENVELOPE_RADIUS, angleDeg);
}

export function pointsToPath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export function sliceOverlappingSegments(points: readonly Point[], segments: number): Point[][] {
  const step = (points.length - 1) / segments;
  const result: Point[][] = [];
  for (let s = 0; s < segments; s++) {
    const start = Math.round(s * step);
    const end = Math.round((s + 1) * step);
    result.push(points.slice(start, end + 1));
  }
  return result;
}

const CURL_SCALE = 26;

export function buildKnotStrandPath(nodeXFraction: number, nodeYFraction: number, angleDeg: number, curl: number): string {
  const node: Point = { x: nodeXFraction * CANVAS_SIZE, y: nodeYFraction * CANVAS_SIZE };
  const entry = pointOnCircle(CENTER, ENVELOPE_RADIUS, angleDeg);
  const exit = pointOnCircle(CENTER, ENVELOPE_RADIUS, angleDeg + 180);
  const offset = curl * CURL_SCALE;

  const entryTangent = tangentUnit(angleDeg);
  const exitTangent = tangentUnit(angleDeg + 180);

  const c1 = { x: entry.x + entryTangent.x * offset, y: entry.y + entryTangent.y * offset };
  const c2 = { x: node.x + entryTangent.x * offset, y: node.y + entryTangent.y * offset };
  const c3 = { x: node.x + exitTangent.x * offset, y: node.y + exitTangent.y * offset };
  const c4 = { x: exit.x + exitTangent.x * offset, y: exit.y + exitTangent.y * offset };

  return (
    `M ${entry.x} ${entry.y} ` +
    `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${node.x} ${node.y} ` +
    `C ${c3.x} ${c3.y} ${c4.x} ${c4.y} ${exit.x} ${exit.y}`
  );
}

const BRAID_SAMPLE_COUNT = 40;
const BRAID_START = 0.15; // central 70% of the canvas (15%..85%) along the diagonal
const BRAID_END = 0.85;

export function buildBraidStrandPoints(strandIndex: 0 | 1 | 2, crossings: number, curl: number): Point[] {
  const start: Point = { x: BRAID_START * CANVAS_SIZE, y: BRAID_START * CANVAS_SIZE };
  const end: Point = { x: BRAID_END * CANVAS_SIZE, y: BRAID_END * CANVAS_SIZE };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  const dirX = dx / len;
  const dirY = dy / len;
  const perpX = -dirY;
  const perpY = dirX;
  const amplitude = 12 + curl * 20;
  const phase = strandIndex * ((2 * Math.PI) / 3);
  const freq = crossings / 2;

  const points: Point[] = [];
  for (let i = 0; i <= BRAID_SAMPLE_COUNT; i++) {
    const t = i / BRAID_SAMPLE_COUNT;
    const cx = start.x + dx * t;
    const cy = start.y + dy * t;
    const wave = Math.sin(2 * Math.PI * freq * t + phase);
    const offset = amplitude * wave;
    points.push({ x: cx + perpX * offset, y: cy + perpY * offset });
  }
  return points;
}

const SPIRAL_SAMPLE_COUNT = 40;

export function buildSpiralStrandPoints(entryAngleDeg: number, turns: number, curl: number): Point[] {
  const rStart = ENVELOPE_RADIUS * 0.12;
  const rEnd = ENVELOPE_RADIUS * (0.82 + curl * 0.18);
  const points: Point[] = [];
  for (let i = 0; i <= SPIRAL_SAMPLE_COUNT; i++) {
    const t = i / SPIRAL_SAMPLE_COUNT;
    const r = rStart + (rEnd - rStart) * t;
    const angle = entryAngleDeg + t * turns * 360;
    points.push(pointOnCircle(CENTER, r, angle));
  }
  return points;
}

const PERMUTATIONS: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

export function drawOrderFromWeave(weave: number): readonly [number, number, number] {
  return PERMUTATIONS[((weave % 6) + 6) % 6];
}
