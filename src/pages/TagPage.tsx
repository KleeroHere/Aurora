import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMaterialsByTag, getSections } from "../data/repository";
import type { MaterialSummary, Section } from "../data/types";
import MaterialCard from "../components/MaterialCard/MaterialCard";
import MaterialCardSkeleton from "../components/MaterialCard/MaterialCardSkeleton";
import QuickPeekModal from "../components/QuickPeekModal/QuickPeekModal";
import { WORDS, pluralize } from "../utils/humanText";
import "./TagPage.css";

const SKELETON_COUNT = 8;

export default function TagPage() {
  const { tag: rawTag } = useParams<{ tag: string }>();
  const tag = rawTag ? decodeURIComponent(rawTag) : "";
  const [materials, setMaterials] = useState<MaterialSummary[] | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [quickPeek, setQuickPeek] = useState<{ group: MaterialSummary[]; index: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMaterials(null);
    Promise.all([getMaterialsByTag(`#${tag}`), getSections()]).then(([found, sectionDocs]) => {
      if (cancelled) return;
      setMaterials(found);
      setSections(sectionDocs);
    });
    return () => {
      cancelled = true;
    };
  }, [tag]);

  const sectionTitle = useMemo(() => {
    const map = new Map(sections.map((s) => [s._id, s.title]));
    return (sectionId: string) => map.get(sectionId) ?? sectionId;
  }, [sections]);

  const groups = useMemo(() => {
    if (!materials) return [];
    const bySection = new Map<string, MaterialSummary[]>();
    for (const material of materials) {
      const list = bySection.get(material.sectionId) ?? [];
      list.push(material);
      bySection.set(material.sectionId, list);
    }
    return [...bySection.entries()].sort((a, b) => sectionTitle(a[0]).localeCompare(sectionTitle(b[0]), "en"));
  }, [materials, sectionTitle]);

  return (
    <div className="tag-page">
      <p className="tag-page__eyebrow">Tag</p>
      <h1 className="tag-page__title">#{tag}</h1>
      {materials !== null && materials.length > 0 && (
        <p className="tag-page__count">{pluralize(materials.length, WORDS.material)}</p>
      )}

      {materials === null ? (
        <div className="tag-page__grid" data-help="tag-materials">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <MaterialCardSkeleton key={i} />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="tag-page__empty">
          <p>No materials found with this tag.</p>
          <Link to="/" className="tag-page__empty-button">
            Back to home
          </Link>
        </div>
      ) : (
        groups.map(([sectionId, group]) => (
          <section key={sectionId} className="tag-page__group">
            <h2 className="tag-page__group-title">{sectionTitle(sectionId)}</h2>
            <div className="tag-page__grid cascade-grid">
              {group.map((material, index) => (
                <MaterialCard
                  key={material._id}
                  material={material}
                  onQuickPeek={() => setQuickPeek({ group, index })}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {quickPeek && (
        <QuickPeekModal
          materials={quickPeek.group}
          initialIndex={quickPeek.index}
          onClose={() => setQuickPeek(null)}
        />
      )}
    </div>
  );
}
