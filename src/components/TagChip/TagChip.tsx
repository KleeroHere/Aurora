import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { tagColorVar } from "../../utils/tagColor";
import "./TagChip.css";

export default function TagChip({
  tag,
  interactive = true,
}: {
  tag: string;
  interactive?: boolean;
}) {
  const color = tagColorVar(tag);
  const style: CSSProperties = {
    backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
  };
  const label = tag.startsWith("#") ? tag : `#${tag}`;

  if (!interactive) {
    return (
      <span className="tag-chip" style={style}>
        {label}
      </span>
    );
  }

  return (
    <Link to={`/tag/${encodeURIComponent(tag.replace(/^#/, ""))}`} className="tag-chip" style={style}>
      {label}
    </Link>
  );
}
