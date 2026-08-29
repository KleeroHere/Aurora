import { memo, useMemo } from "react";
import type { CardColor } from "../../data/types";
import { renderGlyphDataUrl } from "../../utils/glyphCanvas";
import { resolveGlyphColorKey } from "../../utils/glyphParams";
import { useTheme } from "../../context/ThemeContext";
import { useLiteMode } from "../../context/LiteModeContext";
import { useEmergencyMode } from "../../context/EmergencyModeContext";

interface GlyphProps {
  materialId: string;
  cardColor: CardColor | null;
  className?: string;
}

function GlyphImpl({ materialId, cardColor, className }: GlyphProps) {
  const { theme, palette } = useTheme();
  const { liteMode } = useLiteMode();
  const { emergencyMode } = useEmergencyMode();
  const flatFill = liteMode || emergencyMode;
  const dataUrl = useMemo(
    () => (flatFill ? null : renderGlyphDataUrl(materialId, cardColor)),
    [materialId, cardColor, theme, palette, flatFill],
  );

  if (flatFill) {
    const colorKey = resolveGlyphColorKey(materialId, cardColor);
    const style = { background: `linear-gradient(135deg, var(--glyph-pair-${colorKey}-from), var(--glyph-pair-${colorKey}-to))` };
    return <div className={className} role="img" aria-hidden="true" style={style} />;
  }

  return <img src={dataUrl!} alt="" role="img" aria-hidden="true" className={className} />;
}

function areEqual(prev: GlyphProps, next: GlyphProps): boolean {
  return prev.materialId === next.materialId && prev.cardColor === next.cardColor && prev.className === next.className;
}

const Glyph = memo(GlyphImpl, areEqual);
export default Glyph;
