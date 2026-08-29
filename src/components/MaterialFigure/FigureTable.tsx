import type { FigureCell, FigureTableSpec } from "./figureTypes";

const VIEW_WIDTH = 1000;
const PAD_X = 12;
const PAD_Y = 9;
const LINE_RATIO = 1.32;
const MIN_ROW_HEIGHT = 32;
const HEAD_HEIGHT = 38;
const BAND_PAD_Y = 10;

function charWidthRatio(text: string): number {
  return /[a-zа-яё]/u.test(text) ? 0.545 : 0.62;
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const perLine = Math.max(3, Math.floor(maxWidth / (fontSize * charWidthRatio(paragraph))));
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= perLine || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

interface Placed {
  cell: FigureCell;
  column: number;
  rowIndex: number;
  rowSpan: number;
  lines: string[];
}

export default function FigureTable({ spec }: { spec: FigureTableSpec }) {
  const fontSize = spec.fontSize ?? 13;
  const lineHeight = fontSize * LINE_RATIO;

  const totalWeight = spec.columns.reduce((sum, c) => sum + c.weight, 0);
  const columnWidths = spec.columns.map((c) => (c.weight / totalWeight) * VIEW_WIDTH);
  const columnX = columnWidths.reduce<number[]>((acc, _width, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + columnWidths[i - 1]);
    return acc;
  }, []);

  const placed: Placed[] = [];
  const occupied = new Array(spec.columns.length).fill(0);
  const bandRows = new Map<number, string[]>();

  spec.rows.forEach((row, rowIndex) => {
    if (row.type === "band") {
      bandRows.set(rowIndex, wrapText(row.text, VIEW_WIDTH - 2 * PAD_X, fontSize * 1.05));
      occupied.fill(0);
      return;
    }
    let cursor = 0;
    for (const cell of row.cells) {
      while (cursor < occupied.length && occupied[cursor] > 0) cursor += 1;
      if (cursor >= occupied.length) break;
      const rowSpan = Math.max(1, cell.rowSpan ?? 1);
      const width = columnWidths[cursor] - 2 * PAD_X;
      placed.push({ cell, column: cursor, rowIndex, rowSpan, lines: wrapText(cell.text, width, fontSize) });
      occupied[cursor] = rowSpan;
      cursor += 1;
    }
    for (let i = 0; i < occupied.length; i += 1) if (occupied[i] > 0) occupied[i] -= 1;
  });

  const rowHeights = spec.rows.map((_row, rowIndex) => {
    const band = bandRows.get(rowIndex);
    if (band) return band.length * lineHeight + 2 * BAND_PAD_Y;
    const own = placed.filter((p) => p.rowIndex === rowIndex && p.rowSpan === 1);
    const needed = own.reduce((max, p) => Math.max(max, p.lines.length * lineHeight + 2 * PAD_Y), 0);
    return Math.max(MIN_ROW_HEIGHT, needed);
  });

  for (const p of placed) {
    if (p.rowSpan === 1) continue;
    const span = rowHeights.slice(p.rowIndex, p.rowIndex + p.rowSpan);
    const available = span.reduce((a, b) => a + b, 0);
    const needed = p.lines.length * lineHeight + 2 * PAD_Y;
    if (needed > available) rowHeights[p.rowIndex + p.rowSpan - 1] += needed - available;
  }

  const rowY: number[] = [];
  const headOffset = spec.headless ? 0 : HEAD_HEIGHT;
  rowHeights.reduce((y, h, i) => {
    rowY[i] = y;
    return y + h;
  }, headOffset);
  const bodyHeight = rowHeights.reduce((a, b) => a + b, 0);

  const footnoteLines = spec.footnote ? wrapText(spec.footnote, VIEW_WIDTH - 2 * PAD_X, fontSize * 0.92) : [];
  const footnoteHeight = footnoteLines.length ? footnoteLines.length * lineHeight + 2 * PAD_Y : 0;
  const totalHeight = headOffset + bodyHeight + footnoteHeight;

  function textBlock(
    lines: string[],
    left: number,
    width: number,
    top: number,
    height: number,
    cell?: FigureCell,
    size = fontSize,
  ) {
    const blockHeight = lines.length * lineHeight;
    const first = top + (height - blockHeight) / 2 + size * 0.98;
    const align = cell?.align ?? "center";
    const anchorX = align === "left" ? left + PAD_X : left + width / 2;
    return (
      <text
        x={anchorX}
        y={first}
        fontSize={size}
        textAnchor={align === "left" ? "start" : "middle"}
        fontWeight={cell?.bold ? 600 : 400}
        fontStyle={cell?.italic ? "italic" : "normal"}
        className={cell?.head ? "figure-table__ink figure-table__ink--head" : "figure-table__ink"}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={anchorX} dy={i === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    );
  }

  return (
    <svg
      className="figure-table"
      viewBox={`0 0 ${VIEW_WIDTH} ${totalHeight}`}
      role="img"
      aria-label={spec.caption}
      preserveAspectRatio="xMidYMin meet"
    >
      <rect x="0" y="0" width={VIEW_WIDTH} height={totalHeight} className="figure-table__surface" />

      {spec.rows.map((row, i) =>
        row.type === "cells" && i % 2 === 1 ? (
          <rect key={`z${i}`} x="0" y={rowY[i]} width={VIEW_WIDTH} height={rowHeights[i]} className="figure-table__zebra" />
        ) : null,
      )}

      {!spec.headless && (
        <>
          <rect x="0" y="0" width={VIEW_WIDTH} height={HEAD_HEIGHT} className="figure-table__head" />
          {spec.columns.map((column, i) =>
            textBlock(
              wrapText(column.title, columnWidths[i] - 2 * PAD_X, fontSize),
              columnX[i],
              columnWidths[i],
              0,
              HEAD_HEIGHT,
              { text: column.title, bold: true, head: true },
            ),
          )}
        </>
      )}

      {spec.rows.map((row, i) =>
        row.type === "band" ? (
          <g key={`b${i}`}>
            <rect x="0" y={rowY[i]} width={VIEW_WIDTH} height={rowHeights[i]} className="figure-table__head" />
            {textBlock(
              bandRows.get(i)!,
              0,
              VIEW_WIDTH,
              rowY[i],
              rowHeights[i],
              { text: row.text, bold: true, head: true },
              fontSize * 1.05,
            )}
          </g>
        ) : null,
      )}

      {placed.map((p, i) => {
        const top = rowY[p.rowIndex];
        const height = rowHeights.slice(p.rowIndex, p.rowIndex + p.rowSpan).reduce((a, b) => a + b, 0);
        return (
          <g key={`c${i}`}>
            {p.cell.head && (
              <rect
                x={columnX[p.column]}
                y={top}
                width={columnWidths[p.column]}
                height={height}
                className="figure-table__head figure-table__head--cell"
              />
            )}
            {textBlock(p.lines, columnX[p.column], columnWidths[p.column], top, height, p.cell)}
          </g>
        );
      })}

      <g className="figure-table__grid">
        {rowY.map((y, i) =>
          i === 0 && spec.headless ? null : <line key={`h${i}`} x1="0" y1={y} x2={VIEW_WIDTH} y2={y} />,
        )}
        <line x1="0" y1={headOffset + bodyHeight} x2={VIEW_WIDTH} y2={headOffset + bodyHeight} />
        {columnX.map((x, i) =>
          i === 0 ? null : <line key={`v${i}`} x1={x} y1={0} x2={x} y2={headOffset + bodyHeight} />,
        )}
        <rect x="0" y="0" width={VIEW_WIDTH} height={headOffset + bodyHeight} fill="none" />
      </g>

      {footnoteLines.length > 0 &&
        textBlock(
          footnoteLines,
          0,
          VIEW_WIDTH,
          headOffset + bodyHeight,
          footnoteHeight,
          { text: spec.footnote!, align: "left" },
          fontSize * 0.92,
        )}
    </svg>
  );
}
