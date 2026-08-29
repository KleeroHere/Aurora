import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTheme } from "./ThemeContext";
import type { Scheme } from "./ThemeContext";
import { useLiteMode } from "./LiteModeContext";

const STORAGE_KEY = "aurora.dayNightAuto";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // once per hour of an active session, not on a frequent timer

function getInitialEnabled(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

export type Daypart = "morning" | "day" | "evening" | "night";

function isNightHour(hour: number): boolean {
  return hour >= 22 || hour < 6;
}

export function computeDaypart(hour: number): Daypart {
  if (isNightHour(hour)) return "night";
  if (hour < 11) return "morning";
  if (hour < 18) return "day";
  return "evening";
}

interface DayNightModeContextValue {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
}

const DayNightModeContext = createContext<DayNightModeContextValue | undefined>(undefined);

export function DayNightModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(getInitialEnabled);
  const { theme, setTheme } = useTheme();
  const { liteMode } = useLiteMode();

  const themeRef = useRef(theme);
  themeRef.current = theme;
  const baselineRef = useRef<Scheme | null>(null);
  const autoAppliedRef = useRef<Scheme | null>(null);
  const overriddenRef = useRef(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  }, [enabled]);

  useEffect(() => {
    if (autoAppliedRef.current !== null && theme !== autoAppliedRef.current) {
      overriddenRef.current = true;
    }
  }, [theme]);

  useEffect(() => {
    if (!enabled || liteMode) {
      document.documentElement.removeAttribute("data-daypart");
      return;
    }

    function tick() {
      const hour = new Date().getHours();
      const daypart = computeDaypart(hour);
      document.documentElement.setAttribute("data-daypart", daypart);

      if (overriddenRef.current) return; // the theme is no longer touched in this session

      if (daypart === "night") {
        if (baselineRef.current === null) baselineRef.current = themeRef.current;
        if (themeRef.current !== "dark") {
          autoAppliedRef.current = "dark";
          setTheme("dark");
        }
      } else if (baselineRef.current !== null) {
        const restore = baselineRef.current;
        baselineRef.current = null;
        if (themeRef.current !== restore) {
          autoAppliedRef.current = restore;
          setTheme(restore);
        }
      }
    }

    tick();
    const interval = window.setInterval(tick, CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [enabled, liteMode, setTheme]);

  function setEnabled(next: boolean) {
    if (!next) {
      document.documentElement.removeAttribute("data-daypart");
      baselineRef.current = null;
    }
    setEnabledState(next);
  }

  return (
    <DayNightModeContext.Provider value={{ enabled, setEnabled }}>{children}</DayNightModeContext.Provider>
  );
}

export function useDayNightMode(): DayNightModeContextValue {
  const ctx = useContext(DayNightModeContext);
  if (!ctx) {
    throw new Error("useDayNightMode must be used within DayNightModeProvider");
  }
  return ctx;
}
