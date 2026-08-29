import { memo } from "react";
import type { CSSProperties } from "react";
import { coverPatternFor, coverToneFor } from "../../utils/coverPattern";
import { coverIllustrationFor } from "../../utils/coverIllustration";
import { useLiteMode } from "../../context/LiteModeContext";
import { useEmergencyMode } from "../../context/EmergencyModeContext";
import "./PatternCover.css";

interface PatternCoverProps {
  materialId: string;
  title: string;
  className?: string;
}

function PatternCoverImpl({ materialId, title, className }: PatternCoverProps) {
  const { liteMode } = useLiteMode();
  const { emergencyMode } = useEmergencyMode();
  const flat = liteMode || emergencyMode;

  const illustration = flat ? null : coverIllustrationFor(title, materialId);

  const style = {
    "--cover-pattern-url": flat ? "none" : `url("${coverPatternFor(materialId)}")`,
    "--cover-tone": String(coverToneFor(materialId)),
    ...(illustration ? { "--cover-illustration-url": `url("${illustration}")` } : null),
  } as CSSProperties;

  return (
    <div
      className={`pattern-cover${className ? " " + className : ""}`}
      style={style}
      data-tone={coverToneFor(materialId)}
      data-illustrated={illustration ? "true" : undefined}
    >
      {illustration && <span className="pattern-cover__art" aria-hidden="true" />}
      <span className="pattern-cover__title" aria-hidden="true">
        {title}
      </span>
    </div>
  );
}

function areEqual(prev: PatternCoverProps, next: PatternCoverProps): boolean {
  return prev.materialId === next.materialId && prev.title === next.title && prev.className === next.className;
}

const PatternCover = memo(PatternCoverImpl, areEqual);
export default PatternCover;
