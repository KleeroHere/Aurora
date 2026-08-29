import { describe, expect, it } from "vitest";
import { MACRO_COVERS } from "./macroCovers";
import { PALETTES } from "../../data/types";
import type { MacroCategory } from "../../data/types";

describe("macro category covers", () => {
  it("a category that has a cover has one for every palette", () => {
    const entries = Object.entries(MACRO_COVERS) as [MacroCategory, Record<string, string>][];
    expect(entries.length).toBeGreaterThan(0);

    for (const [macro, covers] of entries) {
      for (const palette of PALETTES) {
        expect(covers[palette], `${macro} / ${palette}`).toBeTruthy();
      }
      expect(Object.keys(covers).sort(), macro).toEqual([...PALETTES].sort());
    }
  });
});
