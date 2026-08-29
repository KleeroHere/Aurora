import { Navigate, useParams } from "react-router-dom";
import { useContentIndex } from "../data/useContentIndex";
import { compareMaterials } from "../data/sortMaterials";
import { MACRO_CATEGORIES } from "../data/types";
import type { MacroCategory } from "../data/types";
import SectionCard from "../components/SectionCard/SectionCard";
import SectionCardSkeleton from "../components/SectionCard/SectionCardSkeleton";
import SectionBanner from "../components/SectionBanner/SectionBanner";
import "./MacroPage.css";

const SKELETON_COUNT = 6;

const MACRO_DESCRIPTIONS: Record<MacroCategory, string> = {
  formal: "Forms, journals and the documents the centre is held to.",
  methods: "How the day is run and how the work is actually done.",
  instructions: "Step-by-step protocols for the moments that cannot wait."  ,
  other: "What happens after the programme ends."  ,
};

const STACK_MATERIAL_THRESHOLD = 15;

function isMacroCategory(value: string | undefined): value is MacroCategory {
  return value !== undefined && value in MACRO_CATEGORIES;
}

export default function MacroPage() {
  const { macroId } = useParams<{ macroId: string }>();
  const { sectionGroups, loading } = useContentIndex();

  if (!isMacroCategory(macroId)) {
    return <Navigate to="/" replace />;
  }

  const groups = sectionGroups
    .filter(({ section }) => section.macroCategory === macroId)
    .sort((a, b) => compareMaterials(a.section, b.section));

  const hasChildren = (sectionId: string) => groups.some(({ section }) => section.parentId === sectionId);

  return (
    <div className="macro-page">
      <SectionBanner seedId={macroId} />

      <div className="macro-page__top">
        <h1 className="macro-page__title">{MACRO_CATEGORIES[macroId]}</h1>
        <p className="macro-page__description">{MACRO_DESCRIPTIONS[macroId]}</p>
      </div>

      {loading ? (
        <div className="macro-page__grid" data-help="macro-sections">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <SectionCardSkeleton key={i} />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="macro-page__hint">No sections in this macro category yet.</p>
      ) : (
        <div className="macro-page__grid cascade-grid">
          {groups.map(({ section, materials }) => (
            <SectionCard
              key={section._id}
              section={section}
              materialCount={materials.length}
              stacked={hasChildren(section._id) || materials.length > STACK_MATERIAL_THRESHOLD}
            />
          ))}
        </div>
      )}
    </div>
  );
}
