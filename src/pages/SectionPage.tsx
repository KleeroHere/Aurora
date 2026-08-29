import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getMaterialsBySection, getSectionById } from "../data/repository";
import type { MaterialSummary, MaterialType, Section } from "../data/types";
import MaterialCard from "../components/MaterialCard/MaterialCard";
import MaterialCardSkeleton from "../components/MaterialCard/MaterialCardSkeleton";
import { takeReturnPoint } from "../data/returnPoint";
import SectionBanner from "../components/SectionBanner/SectionBanner";
import SearchInput from "../components/SearchInput/SearchInput";
import { filterMaterialsByTags } from "../utils/filterByTags";
import { filterMaterialsByTypes } from "../utils/filterByType";
import { MATERIAL_TYPE_LABELS } from "../data/materialTypeLabels";
import { useRipple } from "../utils/useRipple";
import { pluralize } from "../utils/humanText";
import { useDocumentTitle } from "../utils/documentTitle";
import QuickPeekModal from "../components/QuickPeekModal/QuickPeekModal";
import "./SectionPage.css";

const SKELETON_COUNT = 8;

const TAGS_PARAM = "tags";
const TYPES_PARAM = "types";
const MATERIAL_TYPES: MaterialType[] = ["article", "form", "presentation", "film"];

function parseTagsParam(params: URLSearchParams): string[] {
  const raw = params.get(TAGS_PARAM);
  return raw ? raw.split(",").filter(Boolean) : [];
}

function isMaterialType(value: string): value is MaterialType {
  return (MATERIAL_TYPES as string[]).includes(value);
}

function parseTypesParam(params: URLSearchParams): MaterialType[] {
  const raw = params.get(TYPES_PARAM);
  if (!raw) return [];
  return raw.split(",").filter(isMaterialType);
}

function buildFilterParams(tags: string[], types: MaterialType[]): Record<string, string> {
  const params: Record<string, string> = {};
  if (tags.length > 0) params[TAGS_PARAM] = tags.join(",");
  if (types.length > 0) params[TYPES_PARAM] = types.join(",");
  return params;
}

function countTagsInSection(materials: MaterialSummary[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const material of materials) {
    for (const tag of material.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

function countTypesInSection(materials: MaterialSummary[]): Map<MaterialType, number> {
  const counts = new Map<MaterialType, number>();
  for (const material of materials) {
    counts.set(material.type, (counts.get(material.type) ?? 0) + 1);
  }
  return counts;
}

export default function SectionPage() {
  const { sectionId: rawSectionId } = useParams<{ sectionId: string }>();
  const sectionId = rawSectionId ? decodeURIComponent(rawSectionId) : "";
  const [section, setSection] = useState<Section | null | undefined>(undefined);
  useDocumentTitle(section?.title);
  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [localQuery, setLocalQuery] = useState("");
  const ripple = useRipple();
  const [quickPeekIndex, setQuickPeekIndex] = useState<number | null>(null);

  const activeTags = useMemo(() => parseTagsParam(searchParams), [searchParams]);
  const activeTypes = useMemo(() => parseTypesParam(searchParams), [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getSectionById(sectionId), getMaterialsBySection(sectionId)]).then(
      ([sectionDoc, materialDocs]) => {
        if (!cancelled) {
          setSection(sectionDoc ?? null);
          setMaterials(materialDocs);
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  useEffect(() => {
    setLocalQuery("");
  }, [sectionId]);

  useEffect(() => {
    if (loading) return;
    const materialId = takeReturnPoint(sectionId);
    if (!materialId) return;

    const frame = requestAnimationFrame(() => {
      const card = document.querySelector<HTMLElement>(`[data-return-anchor="${CSS.escape(materialId)}"]`);
      if (!card) return; // material is filtered out or deleted — nothing to scroll to
      card.scrollIntoView({ block: "center", behavior: "auto" });
      card.dataset.returnHighlight = "yes";
      setTimeout(() => delete card.dataset.returnHighlight, 1600);
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, sectionId]);

  const isPresentationSection = materials.length > 0 && materials.every((m) => m.type === "presentation");
  const tagCounts = useMemo(() => countTagsInSection(materials), [materials]);
  const typeCounts = useMemo(() => countTypesInSection(materials), [materials]);

  const filteredMaterials = useMemo(() => {
    const trimmedQuery = localQuery.trim().toLowerCase();
    const byQuery = trimmedQuery
      ? materials.filter((material) => material.title.toLowerCase().includes(trimmedQuery))
      : materials;
    const byType = filterMaterialsByTypes(byQuery, activeTypes);
    return filterMaterialsByTags(byType, activeTags);
  }, [materials, localQuery, activeTypes, activeTags]);

  function toggleTag(tag: string) {
    const nextTags = activeTags.includes(tag) ? activeTags.filter((t) => t !== tag) : [...activeTags, tag];
    setSearchParams(buildFilterParams(nextTags, activeTypes));
  }

  function toggleType(type: MaterialType) {
    const nextTypes = activeTypes.includes(type) ? activeTypes.filter((t) => t !== type) : [...activeTypes, type];
    setSearchParams(buildFilterParams(activeTags, nextTypes));
  }

  function resetFilters() {
    setSearchParams({});
    setLocalQuery("");
  }

  if (!loading && !section) {
    return (
      <div className="section-page">
        <p className="section-page__hint">Section not found.</p>
        <Link to="/" className="material-page__back">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="section-page">
      {section && <SectionBanner seedId={section._id} />}

      <div className="section-page__top">
        <div>
          <p className="section-page__eyebrow">Section</p>
          <h1 className="section-page__title">{section?.title ?? "…"}</h1>
        </div>
        {section && (
          <Link
            to={`/material/new?section=${encodeURIComponent(section._id)}`}
            className="section-page__create-button btn-ripple"
            onClick={ripple}
          >
            + Create material
          </Link>
        )}
      </div>
      {section?.description && <p className="section-page__description">{section.description}</p>}

      {!loading && materials.length > 0 && (
        <div className="section-page__local-search" data-help="section-search">
          <span className="section-page__local-search-label">Search in section</span>
          <SearchInput
            value={localQuery}
            onChange={setLocalQuery}
            placeholder="Find a material in this section"
            aria-label="Search in this section"
          />
        </div>
      )}

      {(typeCounts.size > 1 || tagCounts.size > 0) && (
        <div className="section-page__filter-groups" data-help="section-filters">
          {typeCounts.size > 1 && (
            <div className="section-page__filters">
              {[...typeCounts.entries()].map(([type, count]) => (
                <button
                  key={type}
                  type="button"
                  className={
                    "section-page__filter-chip" +
                    (activeTypes.includes(type) ? " section-page__filter-chip--active" : "")
                  }
                  onClick={() => toggleType(type)}
                >
                  {MATERIAL_TYPE_LABELS[type]} <span className="section-page__filter-count">{count}</span>
                </button>
              ))}
            </div>
          )}

          {tagCounts.size > 0 && (
            <div className="section-page__filters">
              {[...tagCounts.entries()].map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  className={
                    "section-page__filter-chip" +
                    (activeTags.includes(tag) ? " section-page__filter-chip--active" : "")
                  }
                  onClick={() => toggleTag(tag)}
                >
                  {tag.startsWith("#") ? tag : `#${tag}`} <span className="section-page__filter-count">{count}</span>
                </button>
              ))}
            </div>
          )}

          {(activeTags.length > 0 || activeTypes.length > 0) && (
            <button type="button" className="section-page__filter-reset" onClick={resetFilters}>
              Reset filters
            </button>
          )}
        </div>
      )}

      {!loading && filteredMaterials.length !== materials.length && (
        <p className="section-page__shown-count" role="status">
          Showing {filteredMaterials.length} of {pluralize(materials.length, ["material", "materials", "materials"])}
          .{" "}
          <button type="button" className="section-page__shown-count-reset" onClick={resetFilters}>
            Show all
          </button>
        </p>
      )}

      {loading ? (
        <div className="section-page__grid" data-help="section-materials">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <MaterialCardSkeleton key={i} />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="section-page__empty">
          <p>No materials in this section yet.</p>
          {section && (
            <Link
              to={`/material/new?section=${encodeURIComponent(section._id)}`}
              className="section-page__create-button btn-ripple"
              onClick={ripple}
            >
              + Create material
            </Link>
          )}
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="section-page__empty">
          <p>Nothing matches the selected filters.</p>
          <button type="button" className="section-page__filter-reset" onClick={resetFilters}>
            Reset filters
          </button>
        </div>
      ) : (
        <div
          className={
            "section-page__grid cascade-grid" + (isPresentationSection ? " section-page__grid--presentations" : "")
          }
        >
          {filteredMaterials.map((material, index) => (
            <MaterialCard
              key={material._id}
              material={material}
              anchorId={material._id}
              primaryTag={section?.primaryTag}
              layout={isPresentationSection ? "wide" : "default"}
              onQuickPeek={() => setQuickPeekIndex(index)}
            />
          ))}
        </div>
      )}

      {quickPeekIndex !== null && (
        <QuickPeekModal
          materials={filteredMaterials}
          initialIndex={quickPeekIndex}
          onClose={() => setQuickPeekIndex(null)}
        />
      )}
    </div>
  );
}
