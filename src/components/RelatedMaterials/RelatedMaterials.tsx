import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRelatedMaterials } from "../../data/repository";
import type { MaterialSummary } from "../../data/types";
import "./RelatedMaterials.css";

export default function RelatedMaterials({ materialId, tags }: { materialId: string; tags: string[] }) {
  const [related, setRelated] = useState<MaterialSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (tags.length === 0) {
      setRelated([]);
      return;
    }
    getRelatedMaterials(materialId, tags).then((docs) => {
      if (!cancelled) setRelated(docs);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId, tags.join(",")]);

  if (related.length === 0) return null;

  return (
    <section className="related-materials" aria-label="Related materials" data-help="material-related">
      <p className="related-materials__heading">Similar materials</p>
      <ul className="related-materials__list">
        {related.map((material) => (
          <li key={material._id}>
            <Link to={`/material/${encodeURIComponent(material._id)}`} className="related-materials__chip">
              {material.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
