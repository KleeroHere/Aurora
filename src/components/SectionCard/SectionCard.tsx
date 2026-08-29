import { Link } from "react-router-dom";
import type { Section } from "../../data/types";
import "./SectionCard.css";

interface SectionCardProps {
  section: Section;
  materialCount: number;
  stacked?: boolean;
}

export default function SectionCard({ section, materialCount, stacked = false }: SectionCardProps) {
  return (
    <Link
      to={`/section/${encodeURIComponent(section._id)}`}
      className={"section-card" + (stacked ? " section-card--stacked" : "")}
    >
      <h2 className="section-card__title">{section.title}</h2>
      <p className="section-card__count">{materialCount} materials</p>
    </Link>
  );
}
