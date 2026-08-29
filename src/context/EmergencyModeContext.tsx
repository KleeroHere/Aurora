import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTheme } from "./ThemeContext";
import type { Scheme } from "./ThemeContext";

interface EmergencyModeContextValue {
  emergencyMode: boolean;
  enterEmergencyMode: () => void;
  exitEmergencyMode: () => void;
}

const EmergencyModeContext = createContext<EmergencyModeContextValue | undefined>(undefined);

export function EmergencyModeProvider({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useTheme();
  const [emergencyMode, setEmergencyMode] = useState(false);
  const themeBeforeRef = useRef<Scheme | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("emergency-mode", emergencyMode);
  }, [emergencyMode]);

  function enterEmergencyMode() {
    if (emergencyMode) return;
    themeBeforeRef.current = theme;
    setTheme("dark");
    setEmergencyMode(true);
  }

  function exitEmergencyMode() {
    if (!emergencyMode) return;
    if (themeBeforeRef.current) setTheme(themeBeforeRef.current);
    themeBeforeRef.current = null;
    setEmergencyMode(false);
  }

  return (
    <EmergencyModeContext.Provider value={{ emergencyMode, enterEmergencyMode, exitEmergencyMode }}>
      {children}
    </EmergencyModeContext.Provider>
  );
}

export function useEmergencyMode(): EmergencyModeContextValue {
  const ctx = useContext(EmergencyModeContext);
  if (!ctx) {
    throw new Error("useEmergencyMode must be used within EmergencyModeProvider");
  }
  return ctx;
}
