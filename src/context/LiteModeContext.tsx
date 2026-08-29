import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

const LITE_MODE_STORAGE_KEY = "aurora.liteMode";
const LITE_AUTO_NOTICE_KEY = "aurora.liteMode.autoNoticePending";

function getInitialLiteMode(): boolean {
  const stored = window.localStorage.getItem(LITE_MODE_STORAGE_KEY);
  return stored === "true";
}

interface LiteModeContextValue {
  liteMode: boolean;
  setLiteMode: (next: boolean) => void;
  justAutoEnabled: boolean;
  dismissAutoNotice: () => void;
}

const LiteModeContext = createContext<LiteModeContextValue | undefined>(undefined);

export function LiteModeProvider({ children }: { children: ReactNode }) {
  const [liteMode, setLiteModeState] = useState<boolean>(getInitialLiteMode);
  const [justAutoEnabled, setJustAutoEnabled] = useState<boolean>(
    () => window.localStorage.getItem(LITE_AUTO_NOTICE_KEY) === "true",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("lite", liteMode);
    window.localStorage.setItem(LITE_MODE_STORAGE_KEY, String(liteMode));
  }, [liteMode]);

  function setLiteMode(next: boolean) {
    window.localStorage.removeItem(LITE_AUTO_NOTICE_KEY);
    setJustAutoEnabled(false);
    setLiteModeState(next);
  }

  function dismissAutoNotice() {
    window.localStorage.removeItem(LITE_AUTO_NOTICE_KEY);
    setJustAutoEnabled(false);
  }

  return (
    <LiteModeContext.Provider value={{ liteMode, setLiteMode, justAutoEnabled, dismissAutoNotice }}>
      {children}
    </LiteModeContext.Provider>
  );
}

export function useLiteMode(): LiteModeContextValue {
  const ctx = useContext(LiteModeContext);
  if (!ctx) {
    throw new Error("useLiteMode must be used within LiteModeProvider");
  }
  return ctx;
}
