import type { Palette, Scheme, UserPreferences } from "./types";

export interface Appearance {
  palette: Palette;
  scheme: Scheme;
}

export function resolveAppearance(
  preferences: UserPreferences | undefined,
  fallback: Appearance,
): Appearance {
  return {
    palette: preferences?.palette ?? fallback.palette,
    scheme: preferences?.scheme ?? fallback.scheme,
  };
}
