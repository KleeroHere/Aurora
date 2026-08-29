import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, RefObject } from "react";
import { Link } from "react-router-dom";
import type { CardColor, MaterialSummary } from "../../data/types";
import { getMaterialAttachmentUrl } from "../../data/repository";
import { createObjectUrlTracker } from "../../data/objectUrlTracker";
import { resolveGlyphColorKey } from "../../utils/glyphParams";
import PatternCover from "./PatternCover";
import { useTheme } from "../../context/ThemeContext";
import type { Palette } from "../../context/ThemeContext";
import TagChip from "../TagChip/TagChip";
import { orderTagsForDisplay } from "../../utils/tagColor";
import { formatDuration } from "../../utils/humanText";
import { usePresentationPageCount } from "./usePresentationPageCount";
import { materialTransitionName } from "../../utils/viewTransition";
import CardActionsDock from "../CardActionsDock/CardActionsDock";
import "./MaterialCard.css";

const MAX_VISIBLE_TAGS = 3;

function coverAttachmentFor(cover: { attachment: string; attachmentWarm?: string }, palette: Palette): string {
  void palette;
  return cover.attachment;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function MetaLine({ material }: { material: MaterialSummary }) {
  const video = material.video
    ? ` · video${formatDuration(material.video.durationSec) ? " " + formatDuration(material.video.durationSec) : ""}`
    : "";
  if ((material.type === "article" || material.type === "film") && material.readingTime !== null) {
    return (
      <span className="material-card__meta">
        {material.readingTime} min read{video}
      </span>
    );
  }
  if (material.file) {
    return (
      <span className="material-card__meta">
        {material.file.ext.toUpperCase()} · {formatBytes(material.file.size)}
      </span>
    );
  }
  if (video) return <span className="material-card__meta">{video.slice(3)}</span>;
  return null;
}

function TagChips({ tags, primaryTag }: { tags: string[]; primaryTag?: string }) {
  if (tags.length === 0) return null;
  const ordered = orderTagsForDisplay(tags, primaryTag);
  const visible = ordered.slice(0, MAX_VISIBLE_TAGS);
  const hiddenCount = ordered.length - visible.length;
  return (
    <div className="material-card__tags">
      {visible.map((tag) => (
        <TagChip key={tag} tag={tag} interactive={false} />
      ))}
      {hiddenCount > 0 && <span className="material-card__tag-count">+{hiddenCount}</span>}
    </div>
  );
}

function CoverImage({
  materialId,
  attachmentKey,
  wide,
  cardColor,
}: {
  materialId: string;
  attachmentKey: string;
  wide: boolean;
  cardColor: CardColor;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const trackerRef = useRef(createObjectUrlTracker());

  useEffect(() => {
    let cancelled = false;
    const tracker = trackerRef.current;
    getMaterialAttachmentUrl(materialId, attachmentKey).then((resolved) => {
      if (cancelled) {
        URL.revokeObjectURL(resolved);
        return;
      }
      setUrl(tracker.track(resolved));
    });
    return () => {
      cancelled = true;
      tracker.revokeAll();
    };
  }, [materialId, attachmentKey]);

  if (!url) return null;
  const style = wide
    ? (() => {
        const colorKey = resolveGlyphColorKey(materialId, cardColor);
        return { background: `linear-gradient(135deg, var(--glyph-pair-${colorKey}-from), var(--glyph-pair-${colorKey}-to))` };
      })()
    : undefined;
  return <img src={url} alt="" className="material-card__cover-image" style={style} />;
}

function PageCountBadge({ materialId }: { materialId: string }) {
  const { pageCount, elementRef } = usePresentationPageCount(materialId, true);
  return (
    <span ref={elementRef as RefObject<HTMLSpanElement>} className="material-card__badge">
      {pageCount !== null ? `${pageCount} pp.` : ""}
    </span>
  );
}

function coverTransitionStyle(materialId: string): CSSProperties {
  return { viewTransitionName: materialTransitionName(materialId) } as CSSProperties;
}

function CoverArea({
  material,
  wide,
  onQuickPeek,
}: {
  material: MaterialSummary;
  wide: boolean;
  onQuickPeek?: () => void;
}) {
  const { palette } = useTheme();

  if (material.card.cover) {
    return (
      <div className="material-card__cover" style={coverTransitionStyle(material._id)}>
        <CoverImage
          materialId={material._id}
          attachmentKey={coverAttachmentFor(material.card.cover, palette)}
          wide={wide}
          cardColor={material.card.color}
        />
        {material.type === "presentation" && <PageCountBadge materialId={material._id} />}
        <CardActionsDock materialId={material._id} title={material.title} type={material.type} onQuickPeek={onQuickPeek} />
      </div>
    );
  }

  return (
    <div className="material-card__cover" style={coverTransitionStyle(material._id)}>
      <PatternCover materialId={material._id} title={material.title} />
      {material.type === "form" && material.file && (
        <span className="material-card__ext-badge">{material.file.ext.toUpperCase()}</span>
      )}
      <CardActionsDock materialId={material._id} title={material.title} type={material.type} onQuickPeek={onQuickPeek} />
    </div>
  );
}

export default function MaterialCard({
  material,
  primaryTag,
  layout = "default",
  onQuickPeek,
  anchorId,
}: {
  material: MaterialSummary;
  primaryTag?: string;
  layout?: "default" | "wide";
  onQuickPeek?: (material: MaterialSummary) => void;
  anchorId?: string;
}) {
  function handleKeyDown(event: KeyboardEvent) {
    if (event.code === "Space" && onQuickPeek) {
      event.preventDefault();
      onQuickPeek(material);
    }
  }

  function handleAuxClick(event: MouseEvent) {
    if (event.button === 1 && onQuickPeek) {
      event.preventDefault();
      onQuickPeek(material);
    }
  }

  return (
    <Link
      to={`/material/${encodeURIComponent(material._id)}`}
      className="material-card surface-glass"
      data-return-anchor={anchorId}
      data-card-color={material.card.color}
      data-card-layout={layout}
      data-title-on-cover={material.card.cover ? undefined : "yes"}
      onKeyDown={handleKeyDown}
      onAuxClick={handleAuxClick}
    >
      <CoverArea material={material} wide={layout === "wide"} onQuickPeek={onQuickPeek ? () => onQuickPeek(material) : undefined} />
      <div className="material-card__body">
        <h3 className="material-card__title" title={material.title}>{material.title}</h3>
        <MetaLine material={material} />
        <TagChips tags={material.tags} primaryTag={primaryTag} />
      </div>
    </Link>
  );
}
