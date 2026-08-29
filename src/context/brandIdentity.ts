import type { Palette } from "../data/types";
import auroraMark from "../assets/brand/aurora-mark.png";

/** Brand marks and captions that belong to a palette. */
export interface BrandIdentity {
  readonly mark: string;
  readonly name: string;
  readonly title: string;
  readonly auroraMark: string;
}

/** The palettes share one neutral mark - there is no separate artwork per palette. */
const DEFAULT_IDENTITY: BrandIdentity = {
  mark: auroraMark,
  name: "Staff handbook",
  title: "Staff handbook — home",
  auroraMark: auroraMark,
};

export const BRAND_IDENTITY: Record<Palette, BrandIdentity> = {
  aurora: DEFAULT_IDENTITY,
  clinic: DEFAULT_IDENTITY,
  nightshift: DEFAULT_IDENTITY,
};

export function brandIdentity(palette: Palette): BrandIdentity {
  return BRAND_IDENTITY[palette] ?? BRAND_IDENTITY.aurora;
}
