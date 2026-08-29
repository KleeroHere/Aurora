import { PALETTES } from "../../data/types";
import type { MacroCategory, Palette } from "../../data/types";
import formalAurora from "../../assets/macro/formal-aurora.png";
import methodsAurora from "../../assets/macro/methods-aurora.png";
import instructionsAurora from "../../assets/macro/instructions-aurora.jpg";

/**
 * There is one cover artwork per macro category, shared by every palette.
 * Spelling it out per palette keeps the lookup in the card a plain one:
 * a palette added later has to be given a cover here or the type complains.
 */
function forEveryPalette(cover: string): Record<Palette, string> {
  return Object.fromEntries(PALETTES.map((palette) => [palette, cover])) as Record<Palette, string>;
}

export const MACRO_COVERS: Partial<Record<MacroCategory, Record<Palette, string>>> = {
  formal: forEveryPalette(formalAurora),
  methods: forEveryPalette(methodsAurora),
  instructions: forEveryPalette(instructionsAurora),
};
