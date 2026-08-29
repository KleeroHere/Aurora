import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useDocumentTitle } from "../utils/documentTitle";
import {
  downloadMaterialOriginal,
  getChangeLogForMaterial,
  getMaterialAttachmentUrl,
  getMaterialById,
  getSectionById,
  getAppLog,
  getUserDisplayNames,
  buildMaterialPrintHtml,
} from "../data/repository";
import { rememberReturnPoint } from "../data/returnPoint";
import { createObjectUrlTracker } from "../data/objectUrlTracker";
import VideoPlayer from "../components/VideoPlayer/VideoPlayer";
import { videoOfMaterial } from "../data/videoPort";
import { requestPrintPreview } from "../data/printPreviewBus";
import { showToast } from "../data/toastBus";
import type { AppLog, Change, EditorJsOutputData, Material, Section } from "../data/types";
import BlockRenderer from "../components/BlockRenderer/BlockRenderer";
import MaterialFigure from "../components/MaterialFigure/MaterialFigure";
import PdfViewerModal from "../components/PdfViewerModal/PdfViewerModal";
import MaterialViewPanel from "../components/MaterialViewPanel/MaterialViewPanel";
import MaterialActionsPanel from "../components/MaterialActionsPanel/MaterialActionsPanel";
import RelatedMaterials from "../components/RelatedMaterials/RelatedMaterials";
import ChangeTimeline from "../components/ChangeTimeline/ChangeTimeline";
import TagChip from "../components/TagChip/TagChip";
import Icon from "../components/icons/Icon";
import PinButton from "../components/PinButton/PinButton";
import { orderTagsForDisplay } from "../utils/tagColor";
import { materialTransitionName } from "../utils/viewTransition";
import ReadingProgressBar from "../components/ReadingProgressBar/ReadingProgressBar";
import BackToTop from "../components/BackToTop/BackToTop";
import { useZenMode } from "../context/ZenModeContext";
import MaterialPageSkeleton from "./MaterialPageSkeleton";
import "./MaterialPage.css";
import { formatDuration, humanError } from "../utils/humanText";

function hasListBlocks(data: EditorJsOutputData | undefined): boolean {
  return Boolean(data?.blocks.some((block) => block.type === "list"));
}

function FileMaterialView({ material }: { material: Extract<Material, { type: "form" | "presentation" }> }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const urlTrackerRef = useRef(createObjectUrlTracker());

  useEffect(() => {
    let cancelled = false;
    const tracker = urlTrackerRef.current;
    setPdfUrl(null);
    setPdfError(null);
    setCoverUrl(null);
    getMaterialAttachmentUrl(material._id, material.file.pdf.attachment)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setPdfUrl(tracker.track(url));
      })
      .catch((err) => {
        if (!cancelled) setPdfError(humanError(err));
      });
    if (material.card.cover) {
      getMaterialAttachmentUrl(material._id, material.card.cover.attachment).then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setCoverUrl(tracker.track(url));
      });
    }
    return () => {
      cancelled = true;
      tracker.revokeAll();
    };
  }, [material._id, material.card.cover, retryToken]);

  function handlePrint() {
    if (!pdfUrl) return;
    requestPrintPreview({ pdfUrl, title: material.title });
  }

  function downloadOriginal() {
    return downloadMaterialOriginal(material._id);
  }

  async function handleDownloadOriginal() {
    setDownloadError(null);
    try {
      await downloadOriginal();
    } catch (err) {
      setDownloadError(humanError(err));
    }
  }

  return (
    <div className="material-page__file-viewer" data-help="material-attachment">
      <button
        type="button"
        className="material-page__file-preview"
        data-material-type={material.type}
        onClick={() => setModalOpen(true)}
        aria-haspopup="dialog"
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" className="material-page__file-preview-image" />
        ) : (
          <span className="material-page__file-preview-placeholder">{material.file.original.ext}</span>
        )}
        <span className="material-page__file-preview-hint">Open preview</span>
      </button>

      <div className="material-page__file-toolbar">
        <p className="material-page__file-name">{material.file.original.name}</p>
        <div className="material-page__file-actions">
          <button type="button" className="material-page__file-button" onClick={handlePrint} disabled={!pdfUrl}>
            <Icon name="print" /> Print
          </button>
          <button
            type="button"
            className="material-page__file-button material-page__file-button--secondary"
            onClick={handleDownloadOriginal}
          >
            <Icon name="download" /> Download original ({material.file.original.ext})
          </button>
        </div>
      </div>
      {downloadError && <p className="material-page__file-error">Download error: {downloadError}</p>}

      <PdfViewerModal
        isOpen={modalOpen}
        title={material.title}
        pdfUrl={pdfUrl}
        attachmentError={pdfError}
        onRetryAttachment={() => setRetryToken((t) => t + 1)}
        onClose={() => setModalOpen(false)}
        onDownloadOriginal={downloadOriginal}
      />
    </div>
  );
}

function MaterialMetaRow({ material, section }: { material: Material; section: Section | undefined }) {
  const readingTime = "readingTime" in material ? material.readingTime : null;
  if (readingTime === null && material.tags.length === 0) return null;

  const orderedTags = orderTagsForDisplay(material.tags, section?.primaryTag);

  return (
    <div className="material-page__meta">
      {readingTime !== null && <span className="material-page__reading-time">{readingTime} min read</span>}
      {orderedTags.length > 0 && (
        <div className="material-page__tags" data-help="material-tags">
          {orderedTags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      )}
    </div>
  );
}

async function printBlockMaterial(materialId: string): Promise<void> {
  try {
    const prepared = await buildMaterialPrintHtml(materialId);
    if (!prepared) {
      showToast({ message: "Material not found", role: "error" });
      return;
    }
    requestPrintPreview({ kind: "html", html: prepared.html, title: prepared.title });
  } catch (err) {
    showToast({
      message: `Could not prepare the material for printing: ${humanError(err)}`,
      role: "error",
    });
  }
}

function MaterialHistorySection({ materialId }: { materialId: string }) {
  const [entries, setEntries] = useState<Change[] | null>(null);
  const [appLog, setAppLog] = useState<AppLog[]>([]);
  const [userDisplayNames, setUserDisplayNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    Promise.all([getChangeLogForMaterial(materialId), getAppLog(), getUserDisplayNames()]).then(
      ([changes, log, names]) => {
        if (cancelled) return;
        setEntries(changes);
        setAppLog(log);
        setUserDisplayNames(names);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [materialId]);

  if (!entries || entries.length === 0) return null;

  return (
    <section className="material-page__history" data-help="material-history">
      <h2 className="material-page__subheading">Change history</h2>
      <ChangeTimeline entries={entries} appLog={appLog} userDisplayNames={userDisplayNames} />
    </section>
  );
}

function MaterialBody({ material, interactiveChecklists }: { material: Material; interactiveChecklists: boolean }) {
  switch (material.type) {
    case "article": {
      const video = videoOfMaterial(material);
      return (
        <>
          <BlockRenderer data={material.body} materialId={material._id} interactiveChecklists={interactiveChecklists} />
          <MaterialFigure materialId={material._id} />
          {video && (
            <>
              <h2 className="material-page__subheading">
                Video for this protocol
                {formatDuration(video.durationSec) ? ` — ${formatDuration(video.durationSec)}` : ""}
              </h2>
              <VideoPlayer materialId={material._id} video={video} />
            </>
          )}
        </>
      );
    }
    case "film": {
      const video = videoOfMaterial(material);
      return (
        <>
          {video && <VideoPlayer materialId={material._id} video={video} />}
          <h2 className="material-page__subheading">Introduction (before the screening)</h2>
          <BlockRenderer
            data={material.intro}
            materialId={material._id}
            interactiveChecklists={interactiveChecklists}
          />
          <h2 className="material-page__subheading">Discussion questions (after the screening)</h2>
          <BlockRenderer
            data={material.questions}
            materialId={material._id}
            interactiveChecklists={interactiveChecklists}
          />
        </>
      );
    }
    case "form":
    case "presentation":
      return <FileMaterialView material={material} />;
    default:
      return null;
  }
}

export default function MaterialPage() {
  const { materialId } = useParams<{ materialId: string }>();
  const id = materialId ? decodeURIComponent(materialId) : "";
  const [material, setMaterial] = useState<Material | null | undefined>(undefined);
  const [section, setSection] = useState<Section | undefined>(undefined);
  useDocumentTitle(material?.title);
  const { zenMode, toggleZenMode } = useZenMode();
  useEffect(() => {
    if (!material || (material.type !== "article" && material.type !== "film")) return;
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "p" || event.shiftKey || event.altKey) return;
      event.preventDefault();
      void printBlockMaterial(material!._id);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [material]);
  const [metaPanelOpen, setMetaPanelOpen] = useState(false);
  const [checklistMode, setChecklistMode] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    setMaterial(undefined);
    setMetaPanelOpen(false);
    getMaterialById(id).then((data) => {
      if (!cancelled) setMaterial(data ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!material) {
      setSection(undefined);
      return;
    }
    let cancelled = false;
    getSectionById(material.sectionId).then((sectionDoc) => {
      if (!cancelled) setSection(sectionDoc);
    });
    return () => {
      cancelled = true;
    };
  }, [material?.sectionId]);

  useEffect(() => {
    if (material?.sectionId && material?._id) {
      rememberReturnPoint(material.sectionId, material._id);
    }
  }, [material?._id, material?.sectionId]);

  //
  //
  //
  useEffect(() => {
    setChecklistMode(false);
  }, [material?._id]);

  if (material === undefined) {
    return <MaterialPageSkeleton />;
  }

  if (material === null) {
    return (
      <div className="material-page">
        <p className="material-page__hint">Material not found.</p>
        <Link to="/" className="material-page__back">
          Back to home
        </Link>
      </div>
    );
  }

  const canGoBack = location.key !== "default";
  const sectionHref = `/section/${encodeURIComponent(material.sectionId)}`;

  function handleBack() {
    if (canGoBack) navigate(-1);
    else navigate(sectionHref);
  }

  const materialHasLists =
    material.type === "film"
      ? hasListBlocks(material.intro) || hasListBlocks(material.questions)
      : material.type === "article" && hasListBlocks(material.body);

  return (
    <article className={"material-page" + (zenMode ? " material-page--zen" : "")}>
      {material.type === "article" && <ReadingProgressBar />}
      <BackToTop />
      <div className="material-page__top">
        {!zenMode && (
          <button
            type="button"
            className="material-page__back-button"
            onClick={handleBack}
            title={canGoBack ? "Go back to where you came from" : `Back to section "${section?.title ?? material.sectionId}"`}
          >
            <Icon name="chevron-left" size={16} />
            Back
          </button>
        )}
        {!zenMode && (
          <Link to={sectionHref} className="material-page__breadcrumb">
            {section?.title ?? material.sectionId}
          </Link>
        )}
        <div className="material-page__top-actions" data-help="material-actions">
          {!zenMode && (
            <PinButton materialId={material._id} variant="labeled" className="material-page__toolbar-btn" />
          )}
          {!zenMode && material.type === "article" && (
            <Link
              to={`/material/${encodeURIComponent(material._id)}/edit`}
              className="material-page__edit-link material-page__toolbar-btn"
            >
              <Icon name="edit" size={18} />
              Edit
            </Link>
          )}
          {!zenMode && (material.type === "article" || material.type === "film") && (
            <button
              type="button"
              className="material-page__toolbar-btn"
              onClick={() => printBlockMaterial(material._id)}
              title="Print this material"
            >
              <Icon name="print" size={18} />
              Print
            </button>
          )}
          {!zenMode && (
            <button
              type="button"
              className="material-page__meta-toggle material-page__toolbar-btn"
              onClick={() => setMetaPanelOpen((open) => !open)}
              title={metaPanelOpen ? "Hide view and management" : "View and manage this material"}
              aria-pressed={metaPanelOpen}
              aria-expanded={metaPanelOpen}
            >
              <Icon name="settings" size={18} />
              View and manage
            </button>
          )}
          {!zenMode && materialHasLists && (
            <button
              type="button"
              className="material-page__checklist-toggle material-page__toolbar-btn"
              data-help="material-checklist"
              onClick={() => setChecklistMode((mode) => !mode)}
              title={checklistMode ? "Turn off checklist mode" : "Turn on checklist mode"}
              aria-pressed={checklistMode}
            >
              <Icon name="check-square" size={18} />
              {checklistMode ? "Exit checklist" : "Checklist mode"}
            </button>
          )}
          <button
            type="button"
            className="material-page__zen-toggle material-page__toolbar-btn"
            data-help="material-zen"
            onClick={toggleZenMode}
            title={zenMode ? "Exit reading mode (Esc)" : "Deep reading mode"}
            aria-pressed={zenMode}
          >
            <Icon name={zenMode ? "minimize" : "maximize"} size={18} />
            {zenMode ? "Exit reading mode" : "Reading mode"}
          </button>
        </div>
      </div>
      <h1
        className="material-page__title"
        style={{ viewTransitionName: materialTransitionName(material._id) } as CSSProperties}
      >
        {material.title}
      </h1>
      <MaterialMetaRow material={material} section={section} />
      {!zenMode && metaPanelOpen && (
        <>
          <MaterialViewPanel material={material} onUpdated={setMaterial} />
          <MaterialActionsPanel material={material} section={section} onUpdated={setMaterial} />
        </>
      )}
      <div className="material-page__body" data-help="material-body">
        <MaterialBody material={material} interactiveChecklists={checklistMode} />
      </div>
      {!zenMode && <RelatedMaterials materialId={material._id} tags={material.tags} />}
      {!zenMode && <MaterialHistorySection materialId={material._id} />}
    </article>
  );
}
