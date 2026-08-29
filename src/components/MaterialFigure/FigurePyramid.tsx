import type { FigurePyramidSpec } from "./figureTypes";

const VIEW_WIDTH = 1000;
const HEIGHT = 860;
const BASE_HALF = 460;
const APEX_X = VIEW_WIDTH / 2;
const PAD = 26;
const WEIGHTS = [3.1, 1.15, 1.0, 1.15, 1.15, 1.15, 1.15];

function layoutInTrapezoid(
  words: string[],
  fontSize: number,
  lineHeight: number,
  bandTop: number,
  bandHeight: number,
  blockOffset: number,
  blockTotalLines: number,
  halfWidthAt: (y: number) => number,
): string[] {
  let lines: string[] = [];
  let assumedLines = 1;
  for (let pass = 0; pass < 4; pass += 1) {
    const totalLines = blockTotalLines + assumedLines;
    const blockHeight = totalLines * lineHeight;
    let y = bandTop + (bandHeight - blockHeight) / 2 + blockOffset * lineHeight;
    lines = [];
    let current = "";
    for (const word of words) {
      const capacity = Math.max(
        6,
        Math.floor((2 * halfWidthAt(y - fontSize * 0.85) - 2 * PAD) / (fontSize * 0.57)),
      );
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= capacity || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
        y += lineHeight;
      }
    }
    if (current) lines.push(current);
    if (lines.length === assumedLines) break;
    assumedLines = lines.length;
  }
  return lines;
}

export default function FigurePyramid({ spec }: { spec: FigurePyramidSpec }) {
  const levels = [...spec.levels].reverse(); // top to bottom
  const totalWeight = WEIGHTS.reduce((a, b) => a + b, 0);

  let y = 0;
  const bands = levels.map((level, i) => {
    const height = (WEIGHTS[i] / totalWeight) * HEIGHT;
    const top = y;
    const bottom = y + height;
    y = bottom;
    const halfAt = (yy: number) => (yy / HEIGHT) * BASE_HALF;
    return { level, top, bottom, halfTop: halfAt(top), halfBottom: halfAt(bottom) };
  });

  const titleSize = 17;
  const detailSize = 14.5;

  return (
    <svg
      className="figure-pyramid"
      viewBox={`0 0 ${VIEW_WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={spec.caption}
      preserveAspectRatio="xMidYMin meet"
    >
      {bands.map(({ level, top, bottom, halfTop, halfBottom }, i) => {
        const halfAt = (yy: number) => (yy / HEIGHT) * BASE_HALF;
        const lineH = titleSize * 1.3;
        const titleLines = layoutInTrapezoid(
          level.title.split(/\s+/),
          titleSize,
          lineH,
          top,
          bottom - top,
          0,
          0,
          halfAt,
        );
        const detailLines = layoutInTrapezoid(
          `(${level.detail})`.split(/\s+/),
          detailSize,
          lineH,
          top,
          bottom - top,
          titleLines.length,
          titleLines.length,
          halfAt,
        );
        const blockHeight = (titleLines.length + detailLines.length) * lineH;
        let cursor = top + (bottom - top - blockHeight) / 2 + titleSize;

        const points = [
          `${APEX_X - halfTop},${top}`,
          `${APEX_X + halfTop},${top}`,
          `${APEX_X + halfBottom},${bottom}`,
          `${APEX_X - halfBottom},${bottom}`,
        ].join(" ");

        const titleY = cursor;
        cursor += titleLines.length * lineH;
        const detailY = cursor;

        return (
          <g key={i}>
            <polygon points={points} className={i % 2 === 0 ? "figure-pyramid__band" : "figure-pyramid__band figure-pyramid__band--alt"} />
            <text x={APEX_X} y={titleY} fontSize={titleSize} fontWeight={600} textAnchor="middle" className="figure-table__ink">
              {titleLines.map((line, k) => (
                <tspan key={k} x={APEX_X} dy={k === 0 ? 0 : titleSize * 1.3}>
                  {line}
                </tspan>
              ))}
            </text>
            <text x={APEX_X} y={detailY} fontSize={detailSize} textAnchor="middle" className="figure-table__ink figure-table__ink--muted">
              {detailLines.map((line, k) => (
                <tspan key={k} x={APEX_X} dy={k === 0 ? 0 : detailSize * 1.3}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
      <g className="figure-table__grid">
        {bands.map(({ top, halfTop }, i) =>
          i === 0 ? null : <line key={i} x1={APEX_X - halfTop} y1={top} x2={APEX_X + halfTop} y2={top} />,
        )}
        <polygon points={`${APEX_X},0 ${APEX_X + BASE_HALF},${HEIGHT} ${APEX_X - BASE_HALF},${HEIGHT}`} fill="none" />
      </g>
    </svg>
  );
}
