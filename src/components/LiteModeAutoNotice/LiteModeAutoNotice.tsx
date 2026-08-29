import { useLiteMode } from "../../context/LiteModeContext";
import "./LiteModeAutoNotice.css";

export default function LiteModeAutoNotice() {
  const { justAutoEnabled, dismissAutoNotice } = useLiteMode();
  if (!justAutoEnabled) return null;

  return (
    <div className="lite-mode-auto-notice" role="status">
      <span>
        A low-powered machine was detected — Lite mode is on (fewer visual effects).
        You can turn it off in the admin area, under "Appearance".
      </span>
      <button
        type="button"
        className="lite-mode-auto-notice__close"
        onClick={dismissAutoNotice}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}
