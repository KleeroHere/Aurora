import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { PALETTES } from "../data/types";
import type { Palette, Scheme } from "../data/types";

export type { Palette, Scheme };

const SCHEME_STORAGE_KEY = "aurora.theme";
export const PALETTE_STORAGE_KEY = "aurora.palette";

export function resolveDefaultScheme(): Scheme {
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function getInitialScheme(): Scheme {
  const stored = window.localStorage.getItem(SCHEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return resolveDefaultScheme();
}

export const DEFAULT_PALETTE: Palette = "aurora";

export function isPalette(value: unknown): value is Palette {
  return typeof value === "string" && (PALETTES as readonly string[]).includes(value);
}

export function paletteFromStorage(): Palette {
  try {
    const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    // An unknown or stale value falls back to the default palette.
    if (isPalette(stored)) return stored;
  } catch {
  }
  return DEFAULT_PALETTE;
}

function getInitialPalette(): Palette {
  return paletteFromStorage();
}

interface ThemeContextValue {
  theme: Scheme;
  toggleTheme: () => void;
  setTheme: (next: Scheme) => void;
  palette: Palette;
  setPalette: (palette: Palette) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Scheme>(getInitialScheme);
  const [palette, setPaletteState] = useState<Palette>(getInitialPalette);

  useEffect(() => {
    document.documentElement.setAttribute("data-scheme", theme);
    window.localStorage.setItem(SCHEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", palette);
    window.localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  }, [palette]);

  function toggleTheme() {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }

  function setTheme(next: Scheme) {
    setThemeState(next);
  }

  function setPalette(next: Palette) {
    setPaletteState(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, palette, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
