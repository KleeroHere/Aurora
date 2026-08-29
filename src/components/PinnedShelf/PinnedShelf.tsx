import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { Link } from "react-router-dom";
import { getPinnedMaterials, getSections, subscribe, unpinMaterial } from "../../data/repository";
import { onPinsChanged } from "../../data/pinsBus";
import { useCurrentUser } from "../../context/CurrentUserContext";
import Glyph from "../MaterialCard/Glyph";
import Icon from "../icons/Icon";
import type { MaterialSummary, Section } from "../../data/types";
import "./PinnedShelf.css";

export default function PinnedShelf() {
  const { currentUser } = useCurrentUser();
  const userId = currentUser?._id ?? null;
  const [materials, setMaterials] = useState<MaterialSummary[] | null>(null);
  const [sectionTitles, setSectionTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    function refresh() {
      Promise.all([getPinnedMaterials(userId!), getSections()]).then(([pinned, sections]) => {
        if (cancelled) return;
        setMaterials(pinned);
        setSectionTitles(Object.fromEntries((sections as Section[]).map((s) => [s._id, s.title])));
      });
    }

    refresh();
    const unsubPins = onPinsChanged(refresh);
    const unsubContent = subscribe(() => refresh());
    return () => {
      cancelled = true;
      unsubPins();
      unsubContent();
    };
  }, [userId]);

  async function handleUnpin(materialId: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!userId) return;
    await unpinMaterial(userId, materialId);
  }

  if (!userId || materials === null) return null;

  return (
    <section className="pinned-shelf" data-help="home-pinned">
      <h2 className="pinned-shelf__title">Quick-access shelf</h2>
      {materials.length === 0 ? (
        <p className="pinned-shelf__empty surface-glass">
          Pin up to five materials you come back to often — they will appear here and open in
          one click. The "Pin" button is on the cover of a material's card and on the material's own page.
        </p>
      ) : (
        <div className="pinned-shelf__row">
          {materials.map((material) => (
            <Link
              key={material._id}
              to={`/material/${encodeURIComponent(material._id)}`}
              className="pinned-shelf__item surface-glass"
            >
              <div className="pinned-shelf__item-cover">
                <Glyph materialId={material._id} cardColor={material.card.color} className="pinned-shelf__item-glyph" />
              </div>
              <p className="pinned-shelf__item-title" title={material.title}>
                {material.title}
              </p>
              <p className="pinned-shelf__item-section">{sectionTitles[material.sectionId] ?? ""}</p>
              <button
                type="button"
                className="pinned-shelf__item-unpin"
                onClick={(event) => handleUnpin(material._id, event)}
                title="Unpin"
                aria-label="Unpin"
              >
                <Icon name="close" size={12} />
              </button>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
