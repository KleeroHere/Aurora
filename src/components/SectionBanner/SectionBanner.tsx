import type { CSSProperties } from "react";
import { coverPatternFor, coverToneFor } from "../../utils/coverPattern";
import { useLiteMode } from "../../context/LiteModeContext";
import { useEmergencyMode } from "../../context/EmergencyModeContext";
import "./SectionBanner.css";

export default function SectionBanner({ seedId }: { seedId: string }) {
  const { liteMode } = useLiteMode();
  const { emergencyMode } = useEmergencyMode();
  const flat = liteMode || emergencyMode;

  const style = {
    "--cover-pattern-url": flat ? "none" : `url("${coverPatternFor(seedId)}")`,
  } as CSSProperties;

  return <div className="section-banner" style={style} data-tone={coverToneFor(seedId)} aria-hidden="true" />;
}
