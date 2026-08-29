import { Link } from "react-router-dom";
import { MACRO_CATEGORIES } from "../../data/types";
import type { MacroCategory } from "../../data/types";
import Glyph from "../MaterialCard/Glyph";
import { useTheme } from "../../context/ThemeContext";
import { useLiteMode } from "../../context/LiteModeContext";
import { useEmergencyMode } from "../../context/EmergencyModeContext";
import { MACRO_COVERS } from "./macroCovers";
import "./MacroHeroCard.css";

export default function MacroHeroCard({
  macro,
  sectionCount,
  materialCount,
}: {
  macro: MacroCategory;
  sectionCount: number;
  materialCount: number;
}) {
  const { palette } = useTheme();
  const { liteMode } = useLiteMode();
  const { emergencyMode } = useEmergencyMode();
  const cover = liteMode || emergencyMode ? undefined : MACRO_COVERS[macro]?.[palette];

  return (
    <Link to={`/macro/${macro}`} className="macro-hero-card surface-glass">
      {cover ? (
        <img src={cover} alt="" role="img" aria-hidden="true" className="macro-hero-card__cover" />
      ) : (
        <Glyph materialId={`macro:${macro}`} cardColor={null} className="macro-hero-card__cover" />
      )}
      <div className="macro-hero-card__body">
        <h3 className="macro-hero-card__title">{MACRO_CATEGORIES[macro]}</h3>
        <p className="macro-hero-card__meta">
          {sectionCount} sections · {materialCount} materials
        </p>
      </div>
    </Link>
  );
}
