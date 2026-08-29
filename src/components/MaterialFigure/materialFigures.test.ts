import { describe, expect, it } from "vitest";
import { MATERIAL_FIGURES } from "./materialFigures";
import {
  CHORES_ROTA_TABLE,
  CIRCLE_CARDS,
  FEELINGS_TABLE,
  HANDOVER_TABLE,
  NEEDS_PYRAMID,
  NEWCOMER_DIARY_TABLE,
  WARNING_SIGNS_TABLE,
} from "./figureData";
import type { FigureSpec, FigureTableSpec } from "./figureTypes";
import { seedMaterials } from "../../data/seedData";
import { buildMigratedMaterialId, slugify } from "../../data/slug";

const ALL_FIGURES: FigureSpec[] = [
  FEELINGS_TABLE,
  NEWCOMER_DIARY_TABLE,
  CHORES_ROTA_TABLE,
  HANDOVER_TABLE,
  WARNING_SIGNS_TABLE,
  NEEDS_PYRAMID,
  CIRCLE_CARDS,
];

const TABLES: [string, FigureTableSpec][] = [
  ["feelings", FEELINGS_TABLE],
  ["day journal", NEWCOMER_DIARY_TABLE],
  ["chores rota", CHORES_ROTA_TABLE],
  ["handover", HANDOVER_TABLE],
  ["warning signs", WARNING_SIGNS_TABLE],
];

/** The cells of a table's last row — where signature and sign-off lines live. */
function lastRowCells(table: FigureTableSpec): string[] {
  const last = table.rows[table.rows.length - 1];
  expect(last.type).toBe("cells");
  return last.type === "cells" ? last.cells.map((cell) => cell.text) : [];
}

function seededMaterialIds(): Set<string> {
  return new Set(seedMaterials.map((m) => buildMigratedMaterialId(m.type, m.sectionSlug, slugify(m.nameSlugSource))));
}

describe("built-in figure registry", () => {
  it("every material in the registry ships with the app", () => {
    const seeded = seededMaterialIds();
    for (const id of Object.keys(MATERIAL_FIGURES)) {
      expect(seeded.has(id), `figure attached to ${id}, which the seed does not create`).toBe(true);
    }
  });

  it("every figure has a caption and a page orientation", () => {
    for (const [id, entry] of Object.entries(MATERIAL_FIGURES)) {
      expect(entry.spec.caption, id).toBeTruthy();
      expect(["portrait", "landscape"]).toContain(entry.orientation);
    }
  });

  it("all seven figures are attached, each to a different material", () => {
    const attached = Object.values(MATERIAL_FIGURES).map((entry) => entry.spec);
    expect(attached).toHaveLength(ALL_FIGURES.length);
    for (const spec of ALL_FIGURES) {
      expect(attached, spec.caption).toContain(spec);
    }
  });
});

describe("figure content", () => {
  it.each(TABLES)("%s: rows never overflow the columns", (_name, table) => {
    for (const row of table.rows) {
      if (row.type !== "cells") continue;
      expect(row.cells.length).toBeLessThanOrEqual(table.columns.length);
    }
    expect(table.footnote).toBeTruthy();
  });

  it("feelings: one banded group per feeling, words running weak to strong", () => {
    const groups = FEELINGS_TABLE.rows.filter((row) => row.type === "band");
    expect(groups.length).toBeGreaterThanOrEqual(5);
    expect(FEELINGS_TABLE.columns).toHaveLength(5);
    const ladders = FEELINGS_TABLE.rows.filter(
      (row) => row.type === "cells" && row.cells.some((cell) => cell.text !== ""),
    );
    expect(ladders).toHaveLength(groups.length);
  });

  it("day journal: enough empty rows to write a day into, and a place to sign", () => {
    const empty = NEWCOMER_DIARY_TABLE.rows.filter(
      (row) => row.type === "cells" && row.cells.every((cell) => cell.text === ""),
    );
    expect(empty.length).toBeGreaterThanOrEqual(8);
    expect(lastRowCells(NEWCOMER_DIARY_TABLE)[0]).toMatch(/Signed/);
  });

  it("chores rota: seven days across the top and a checked row at the foot", () => {
    expect(CHORES_ROTA_TABLE.columns).toHaveLength(8);
    expect(CHORES_ROTA_TABLE.columns[0].title).toBe("Area");
    expect(lastRowCells(CHORES_ROTA_TABLE)[0]).toMatch(/Checked/);
  });

  it("handover: both shifts sign the sheet", () => {
    const labels = lastRowCells(HANDOVER_TABLE);
    expect(labels).toContain("Handed over by");
    expect(labels).toContain("Received by");
  });

  it("warning signs: observation, action, and what to avoid on every row", () => {
    expect(WARNING_SIGNS_TABLE.columns).toHaveLength(3);
    const rows = WARNING_SIGNS_TABLE.rows.filter((row) => row.type === "cells");
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (const row of rows) {
      if (row.type !== "cells") continue;
      expect(row.cells).toHaveLength(3);
      for (const cell of row.cells) expect(cell.text).toBeTruthy();
    }
  });

  it("needs pyramid: sleep and food at the base, meaning at the top", () => {
    expect(NEEDS_PYRAMID.levels).toHaveLength(5);
    expect(NEEDS_PYRAMID.levels[0].title).toMatch(/Sleep/);
    expect(NEEDS_PYRAMID.levels[NEEDS_PYRAMID.levels.length - 1].title).toMatch(/Meaning/);
    for (const level of NEEDS_PYRAMID.levels) expect(level.detail).toBeTruthy();
  });

  it("circle cards: two cards, each with four to six prompts", () => {
    expect(CIRCLE_CARDS.cards).toHaveLength(2);
    for (const card of CIRCLE_CARDS.cards) {
      expect(card.bullets?.length, card.title).toBeGreaterThanOrEqual(4);
      expect(card.bullets?.length, card.title).toBeLessThanOrEqual(6);
    }
  });
});
