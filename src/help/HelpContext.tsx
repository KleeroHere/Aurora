import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type HelpMode = "screen" | "tour";

interface HelpContextValue {
  mode: HelpMode | null;
  step: number;
  openScreenHelp: () => void;
  startTour: () => void;
  close: () => void;
  setStep: (next: number) => void;
}

const HelpContext = createContext<HelpContextValue | undefined>(undefined);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<HelpMode | null>(null);
  const [step, setStepState] = useState(0);

  const openScreenHelp = useCallback(() => {
    setStepState(0);
    setMode("screen");
  }, []);

  const startTour = useCallback(() => {
    setStepState(0);
    setMode("tour");
  }, []);

  const close = useCallback(() => setMode(null), []);

  const setStep = useCallback((next: number) => setStepState(Math.max(0, next)), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "F1" || event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;
      event.preventDefault();
      if (mode === null) openScreenHelp();
      else close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mode, openScreenHelp, close]);

  const value = useMemo(
    () => ({ mode, step, openScreenHelp, startTour, close, setStep }),
    [mode, step, openScreenHelp, startTour, close, setStep],
  );

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelp(): HelpContextValue {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error("useHelp must be used within HelpProvider");
  return ctx;
}
