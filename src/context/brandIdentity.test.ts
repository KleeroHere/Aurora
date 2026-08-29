import { describe, expect, it } from "vitest";
import { BRAND_IDENTITY, brandIdentity } from "./brandIdentity";
import { PALETTES } from "../data/types";

describe("brand identity registry", () => {
  it("has an entry for every palette", () => {
    for (const palette of PALETTES) {
      const identity = BRAND_IDENTITY[palette];
      expect(identity, palette).toBeDefined();
      expect(identity.mark, palette).toBeTruthy();
      expect(identity.auroraMark, palette).toBeTruthy();
      expect(identity.name, palette).toBeTruthy();
      expect(identity.title, palette).toBeTruthy();
    }
  });

  it("holds no entries beyond the known palettes", () => {
    expect(Object.keys(BRAND_IDENTITY).sort()).toEqual([...PALETTES].sort());
  });

  it("resolves every palette through the lookup helper", () => {
    for (const palette of PALETTES) {
      expect(brandIdentity(palette), palette).toBe(BRAND_IDENTITY[palette]);
    }
  });
});
