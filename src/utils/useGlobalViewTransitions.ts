import { useEffect } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useLiteMode } from "../context/LiteModeContext";
import { useEmergencyMode } from "../context/EmergencyModeContext";
import { prefersReducedMotion, supportsViewTransitions } from "./viewTransition";

export function useGlobalViewTransitions(): void {
  const navigate = useNavigate();
  const { liteMode } = useLiteMode();
  const { emergencyMode } = useEmergencyMode();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!supportsViewTransitions() || liteMode || emergencyMode || prefersReducedMotion()) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("#/")) return;
      const to = href.slice(1);

      event.preventDefault();
      document.startViewTransition(() => {
        flushSync(() => navigate(to));
      });
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [navigate, liteMode, emergencyMode]);
}
