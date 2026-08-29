import type { ElementType, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { EditorJsBlock, EditorJsListItem, EditorJsOutputData } from "../../data/types";
import {
  downloadMaterialAttachment,
  getMaterialAttachmentKeys,
  getMaterialAttachmentUrl,
  getMaterialById,
} from "../../data/repository";
import { createObjectUrlTracker } from "../../data/objectUrlTracker";
import { extractMaterialIdFromHref, isInternalMaterialLink } from "../../data/internalLinks";
import Icon from "../icons/Icon";
import PdfViewerModal from "../PdfViewerModal/PdfViewerModal";
import "./BlockRenderer.css";
import { humanError } from "../../utils/humanText";

const BROKEN_LINK_CLASS = "block-renderer__link--broken";
const HREF_ATTR_RE = /<a\s+href="([^"]*)"([^>]*)>/g;

function collectInternalHrefs(html: string): string[] {
  const hrefs: string[] = [];
  for (const match of html.matchAll(HREF_ATTR_RE)) {
    const href = match[1];
    if (isInternalMaterialLink(href)) hrefs.push(href);
  }
  return hrefs;
}

function collectAllHrefsFromData(data: EditorJsOutputData): string[] {
  const hrefs: string[] = [];
  function walkItems(items: EditorJsListItem[]) {
    for (const item of items) {
      hrefs.push(...collectInternalHrefs(item.content));
      if (item.items.length > 0) walkItems(item.items);
    }
  }
  for (const block of data.blocks) {
    switch (block.type) {
      case "header":
      case "paragraph":
      case "alert":
        hrefs.push(...collectInternalHrefs(block.data.text));
        break;
      case "quote":
        hrefs.push(...collectInternalHrefs(block.data.text));
        break;
      case "list":
        walkItems(block.data.items);
        break;
      default:
        break;
    }
  }
  return hrefs;
}

function markBrokenLinks(html: string, brokenHrefs: ReadonlySet<string>): string {
  if (brokenHrefs.size === 0) return html;
  return html.replace(HREF_ATTR_RE, (full, href: string, rest: string) => {
    if (!brokenHrefs.has(href)) return full;
    return `<a href="${href}"${rest} class="${BROKEN_LINK_CLASS}">`;
  });
}

function ListItems({
  items,
  style,
  brokenHrefs,
}: {
  items: EditorJsListItem[];
  style: "ordered" | "unordered" | "checklist";
  brokenHrefs: ReadonlySet<string>;
}) {
  const Tag = style === "ordered" ? "ol" : "ul";
  return (
    <Tag className="block-renderer__list">
      {items.map((item, index) => (
        <li key={index}>
          <span dangerouslySetInnerHTML={{ __html: markBrokenLinks(item.content, brokenHrefs) }} />
          {item.items.length > 0 && <ListItems items={item.items} style={style} brokenHrefs={brokenHrefs} />}
        </li>
      ))}
    </Tag>
  );
}

function ChecklistItems({
  items,
  style,
  brokenHrefs,
  checked,
  onToggle,
  pathPrefix,
}: {
  items: EditorJsListItem[];
  style: "ordered" | "unordered" | "checklist";
  brokenHrefs: ReadonlySet<string>;
  checked: ReadonlySet<string>;
  onToggle: (key: string) => void;
  pathPrefix: string;
}) {
  const Tag = style === "ordered" ? "ol" : "ul";
  return (
    <Tag className="block-renderer__list block-renderer__list--checklist">
      {items.map((item, index) => {
        const key = `${pathPrefix}-${index}`;
        return (
          <li key={index} className="block-renderer__checklist-item">
            <label className="block-renderer__checklist-label">
              <input type="checkbox" checked={checked.has(key)} onChange={() => onToggle(key)} />
              <span dangerouslySetInnerHTML={{ __html: markBrokenLinks(item.content, brokenHrefs) }} />
            </label>
            {item.items.length > 0 && (
              <ChecklistItems
                items={item.items}
                style={style}
                brokenHrefs={brokenHrefs}
                checked={checked}
                onToggle={onToggle}
                pathPrefix={key}
              />
            )}
          </li>
        );
      })}
    </Tag>
  );
}

function ChecklistBlock({
  block,
  brokenHrefs,
}: {
  block: Extract<EditorJsBlock, { type: "list" }>;
  brokenHrefs: ReadonlySet<string>;
}) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="block-renderer__checklist">
      <ChecklistItems
        items={block.data.items}
        style={block.data.style}
        brokenHrefs={brokenHrefs}
        checked={checked}
        onToggle={toggle}
        pathPrefix="item"
      />
      {checked.size > 0 && (
        <button type="button" className="block-renderer__checklist-reset" onClick={() => setChecked(new Set())}>
          Clear all checkmarks
        </button>
      )}
    </div>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

function ImageBlock({
  materialId,
  block,
  onOpenLightbox,
}: {
  materialId: string | undefined;
  block: Extract<EditorJsBlock, { type: "image" }>;
  onOpenLightbox: (payload: { materialId: string; attachmentKey: string; url: string; title: string }) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const trackerRef = useRef(createObjectUrlTracker());
  const attachmentKey = block.data.file.key;
  const captionText = stripHtml(block.data.caption || "");

  useEffect(() => {
    setUrl(null);
    setFailed(false);
    if (!materialId) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    const tracker = trackerRef.current;
    getMaterialAttachmentUrl(materialId, attachmentKey)
      .then((resolved) => {
        if (cancelled) {
          URL.revokeObjectURL(resolved);
          return;
        }
        setUrl(tracker.track(resolved));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      tracker.revokeAll();
    };
  }, [materialId, attachmentKey]);

  return (
    <figure className="block-renderer__image">
      {url ? (
        <button
          type="button"
          className="block-renderer__image-button"
          onClick={() =>
            materialId &&
            onOpenLightbox({ materialId, attachmentKey, url, title: captionText || "Image" })
          }
        >
          <img src={url} alt={captionText} className="block-renderer__image-img" />
        </button>
      ) : (
        <div className="block-renderer__image-placeholder">
          {failed ? `Failed to load image: ${attachmentKey}` : "Loading image…"}
        </div>
      )}
      {block.data.caption && <figcaption>{block.data.caption}</figcaption>}
    </figure>
  );
}

function AttachesBlock({
  materialId,
  block,
  onError,
  missing,
}: {
  materialId: string | undefined;
  block: Extract<EditorJsBlock, { type: "attaches" }>;
  onError: (message: string) => void;
  missing: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

  if (missing) {
    return (
      <span className="block-renderer__attaches block-renderer__attaches--missing" role="note">
        <Icon name="paperclip" className="block-renderer__attaches-icon" />
        {block.data.title || block.data.file.name}
        {block.data.file.ext ? ` (${block.data.file.ext})` : ""} — file not attached
      </span>
    );
  }

  async function handleClick() {
    if (!materialId || downloading) return;
    setDownloading(true);
    try {
      await downloadMaterialAttachment(materialId, block.data.file.key, block.data.file.name);
    } catch (err) {
      onError(`Failed to download "${block.data.file.name}": ${humanError(err)}`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button type="button" className="block-renderer__attaches" onClick={handleClick} disabled={downloading}>
      <Icon name="paperclip" className="block-renderer__attaches-icon" />
      {block.data.title || block.data.file.name} ({block.data.file.ext})
    </button>
  );
}

function TableBlock({
  block,
  brokenHrefs,
}: {
  block: Extract<EditorJsBlock, { type: "table" }>;
  brokenHrefs: ReadonlySet<string>;
}) {
  const { withHeadings, content } = block.data;
  if (content.length === 0) return null;
  const head = withHeadings ? content[0] : null;
  const body = withHeadings ? content.slice(1) : content;

  return (
    <div className="block-renderer__table-scroll">
      <table className="block-renderer__table">
        {head && (
          <thead>
            <tr>
              {head.map((cell, i) => (
                <th key={i} dangerouslySetInnerHTML={{ __html: markBrokenLinks(cell, brokenHrefs) }} />
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} dangerouslySetInnerHTML={{ __html: markBrokenLinks(cell, brokenHrefs) }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({
  block,
  brokenHrefs,
  materialId,
  onAttachError,
  onOpenLightbox,
  interactiveChecklists,
  checklistScope,
  missingAttachmentKeys,
}: {
  block: EditorJsBlock;
  brokenHrefs: ReadonlySet<string>;
  materialId: string | undefined;
  onAttachError: (message: string) => void;
  onOpenLightbox: (payload: { materialId: string; attachmentKey: string; url: string; title: string }) => void;
  interactiveChecklists: boolean;
  checklistScope: "only-actionable" | "all";
  missingAttachmentKeys: ReadonlySet<string>;
}) {
  const listIsActionable = block.type === "list" && block.data.meta?.actionable === true;
  const showChecklist =
    interactiveChecklists && (checklistScope === "all" || listIsActionable);
  switch (block.type) {
    case "header": {
      const Tag = `h${Math.min(Math.max(block.data.level, 1), 6)}` as ElementType;
      return (
        <Tag
          className="block-renderer__header"
          dangerouslySetInnerHTML={{ __html: markBrokenLinks(block.data.text, brokenHrefs) }}
        />
      );
    }
    case "paragraph":
      return (
        <p
          className="block-renderer__paragraph"
          dangerouslySetInnerHTML={{ __html: markBrokenLinks(block.data.text, brokenHrefs) }}
        />
      );
    case "list":
      return showChecklist ? (
        <ChecklistBlock block={block} brokenHrefs={brokenHrefs} />
      ) : (
        <ListItems items={block.data.items} style={block.data.style} brokenHrefs={brokenHrefs} />
      );
    case "quote":
      return (
        <blockquote className="block-renderer__quote">
          <p dangerouslySetInnerHTML={{ __html: markBrokenLinks(block.data.text, brokenHrefs) }} />
          {block.data.caption && <cite>{block.data.caption}</cite>}
        </blockquote>
      );
    case "alert":
      return (
        <div
          className={`block-renderer__alert block-renderer__alert--${block.data.type}`}
          dangerouslySetInnerHTML={{ __html: markBrokenLinks(block.data.text, brokenHrefs) }}
        />
      );
    case "table":
      return <TableBlock block={block} brokenHrefs={brokenHrefs} />;
    case "image":
      return <ImageBlock materialId={materialId} block={block} onOpenLightbox={onOpenLightbox} />;
    case "attaches":
      return (
        <AttachesBlock
          materialId={materialId}
          block={block}
          onError={onAttachError}
          missing={missingAttachmentKeys.has(block.data.file.key)}
        />
      );
    default:
      return null;
  }
}

export default function BlockRenderer({
  data,
  materialId,
  interactiveChecklists = false,
}: {
  data: EditorJsOutputData;
  materialId?: string;
  interactiveChecklists?: boolean;
}) {
  const checklistScope: "only-actionable" | "all" = data.blocks.some(
    (block) => block.type === "list" && block.data.meta?.actionable === true,
  )
    ? "only-actionable"
    : "all";
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    materialId: string;
    attachmentKey: string;
    url: string;
    title: string;
  } | null>(null);
  const [brokenHrefs, setBrokenHrefs] = useState<ReadonlySet<string>>(new Set());
  const [missingAttachmentKeys, setMissingAttachmentKeys] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const referenced = data.blocks
      .filter((block) => block.type === "attaches")
      .map((block) => (block as Extract<EditorJsBlock, { type: "attaches" }>).data.file.key)
      .filter(Boolean);

    if (!materialId || referenced.length === 0) {
      setMissingAttachmentKeys(new Set());
      return;
    }

    getMaterialAttachmentKeys(materialId)
      .then((present) => {
        if (cancelled) return;
        setMissingAttachmentKeys(new Set(referenced.filter((key) => !present.has(key))));
      })
      .catch(() => {
        if (!cancelled) setMissingAttachmentKeys(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [data, materialId]);

  useEffect(() => {
    let cancelled = false;
    const hrefs = Array.from(new Set(collectAllHrefsFromData(data)));
    if (hrefs.length === 0) {
      setBrokenHrefs(new Set());
      return;
    }

    Promise.all(
      hrefs.map(async (href) => {
        const id = extractMaterialIdFromHref(href);
        const material = id ? await getMaterialById(id) : undefined;
        return { href, exists: Boolean(material) };
      }),
    ).then((results) => {
      if (cancelled) return;
      setBrokenHrefs(new Set(results.filter((r) => !r.exists).map((r) => r.href)));
    });

    return () => {
      cancelled = true;
    };
  }, [data]);

  async function handleContentClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!isInternalMaterialLink(href)) return; // external link — default browser behavior

    event.preventDefault();
    const materialId = extractMaterialIdFromHref(href);
    if (!materialId) return;

    const material = await getMaterialById(materialId);
    if (!material) {
      setNotice("The material is unavailable — it may have been deleted or not migrated yet.");
      return;
    }
    setNotice(null);
    navigate(`/material/${encodeURIComponent(materialId)}`);
  }

  return (
    <div className="block-renderer" onClick={handleContentClick}>
      {notice && (
        <div className="block-renderer__notice" role="status">
          {notice}
          <button type="button" className="block-renderer__notice-close" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
      {data.blocks.map((block, index) => (
        <Block
          key={block.id ?? index}
          block={block}
          brokenHrefs={brokenHrefs}
          materialId={materialId}
          onAttachError={setNotice}
          onOpenLightbox={setLightbox}
          interactiveChecklists={interactiveChecklists}
          checklistScope={checklistScope}
          missingAttachmentKeys={missingAttachmentKeys}
        />
      ))}

      <PdfViewerModal
        isOpen={lightbox !== null}
        mode="image"
        title={lightbox?.title ?? ""}
        imageUrl={lightbox?.url ?? null}
        onClose={() => setLightbox(null)}
        onDownloadOriginal={() =>
          lightbox
            ? downloadMaterialAttachment(lightbox.materialId, lightbox.attachmentKey, "image")
            : Promise.resolve(false)
        }
      />
    </div>
  );
}
