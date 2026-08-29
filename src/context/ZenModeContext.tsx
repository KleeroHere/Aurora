import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

const ZEN_MODE_STORAGE_KEY = "aurora.zenMode";

function getInitialZenMode(): boolean {
  return window.localStorage.getItem(ZEN_MODE_STORAGE_KEY) === "true";
}

interface ZenModeContextValue {
  zenMode: boolean;
  toggleZenMode: () => void;
  setZenMode: (next: boolean) => void;
}

const ZenModeContext = createContext<ZenModeContextValue | undefined>(undefined);

export function ZenModeProvider({ children }: { children: ReactNode }) {
  const [zenMode, setZenModeState] = useState<boolean>(getInitialZenMode);

  useEffect(() => {
    window.localStorage.setItem(ZEN_MODE_STORAGE_KEY, String(zenMode));
  }, [zenMode]);

  useEffect(() => {
    if (!zenMode) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setZenModeState(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [zenMode]);

  function toggleZenMode() {
    setZenModeState((prev) => !prev);
  }

  function setZenMode(next: boolean) {
    setZenModeState(next);
  }

  return (
    <ZenModeContext.Provider value={{ zenMode, toggleZenMode, setZenMode }}>{children}</ZenModeContext.Provider>
  );
}

export function useZenMode(): ZenModeContextValue {
  const ctx = useContext(ZenModeContext);
  if (!ctx) {
    throw new Error("useZenMode must be used within ZenModeProvider");
  }
  return ctx;
}
