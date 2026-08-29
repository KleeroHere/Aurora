import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { loadPdfDocument } from "../../data/pdf";
import type { PdfDocumentHandle } from "../../data/pdf";
import { requestPrintPreview } from "../../data/printPreviewBus";
import { useFocusTrap } from "../../utils/useFocusTrap";
import Icon from "../icons/Icon";
import "./PdfViewerModal.css";
import { humanError } from "../../utils/humanText";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.2;
const DEFAULT_SCALE = 1.1;

const PDF_LOAD_TIMEOUT_MS = 9000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

interface PdfViewerModalProps {
  isOpen: boolean;
  title: string;
  pdfUrl?: string | null;
  mode?: "pdf" | "image" | "content";
  imageUrl?: string | null;
  content?: ReactNode;
  attachmentError?: string | null;
  onRetryAttachment?: () => void;
  onOpenFull?: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
  onClose: () => void;
  onDownloadOriginal: () => Promise<boolean>;
}

export default function PdfViewerModal({
  isOpen,
  title,
  pdfUrl = null,
  mode = "pdf",
  imageUrl = null,
  content = null,
  attachmentError,
  onRetryAttachment,
  onOpenFull,
  onNavigate,
  onClose,
  onDownloadOriginal,
}: PdfViewerModalProps) {
  const [pdf, setPdf] = useState<PdfDocumentHandle | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, isOpen);

  //
  useEffect(() => {
    if (!isOpen || mode !== "pdf" || !pdfUrl) return;
    let cancelled = false;
    let loadedDoc: PdfDocumentHandle | null = null;
    setLoadError(null);
    setPdf(null);
    setPageNumber(1);
    setScale(DEFAULT_SCALE);
    withTimeout(
      loadPdfDocument(pdfUrl),
      PDF_LOAD_TIMEOUT_MS,
      "Timed out (the file is corrupted or too large).",
    )
      .then((doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        loadedDoc = doc;
        setPdf(doc);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(humanError(err));
      });
    return () => {
      cancelled = true;
      loadedDoc?.destroy();
    };
  }, [isOpen, mode, pdfUrl, retryCount]);

  useEffect(() => {
    if (isOpen && mode === "image") setScale(DEFAULT_SCALE);
  }, [isOpen, mode, imageUrl]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    const canvas = canvasRef.current;

    pdf.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) return;
      page.render({ canvasContext: context, viewport, canvas });
    });

    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber, scale]);

  //
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;

      if (event.code === "Space") {
        const nativelyActivatable =
          activeTag === "BUTTON" || activeTag === "A" || activeTag === "INPUT" || activeTag === "SELECT";
        if (nativelyActivatable) return;
        event.preventDefault();
        onClose();
        return;
      }

      if (onNavigate && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        const editableField = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";
        if (editableField) return;
        event.preventDefault();
        onNavigate(event.key === "ArrowLeft" ? "prev" : "next");
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onNavigate]);

  const zoomIn = useCallback(() => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP)), []);

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    if (event.deltaY < 0) zoomIn();
    else zoomOut();
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  async function handleDownload() {
    setDownloadError(null);
    try {
      await onDownloadOriginal();
    } catch (err) {
      setDownloadError(humanError(err));
    }
  }

  function handlePrint() {
    if (!pdfUrl) return;
    requestPrintPreview({ pdfUrl, title });
  }

  if (!isOpen) return null;

  const numPages = mode === "pdf" ? (pdf?.numPages ?? null) : null;
  const canZoom = mode === "image" ? Boolean(imageUrl) : Boolean(pdf);

  return (
    <div
      className="pdf-viewer-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={handleBackdropClick}
      onWheel={handleWheel}
    >
      <div className="pdf-viewer-modal__panel surface-glass-blur" ref={panelRef}>
        <div className="pdf-viewer-modal__toolbar">
          <p className="pdf-viewer-modal__title" title={title}>
            {title}
          </p>
          {mode !== "content" && (
            <div className="pdf-viewer-modal__zoom">
              <button
                type="button"
                className="pdf-viewer-modal__icon-button"
                onClick={zoomOut}
                disabled={!canZoom || scale <= MIN_SCALE}
                title="Zoom out"
                aria-label="Zoom out"
              >
                <Icon name="zoom-out" />
              </button>
              <button
                type="button"
                className="pdf-viewer-modal__icon-button"
                onClick={zoomIn}
                disabled={!canZoom || scale >= MAX_SCALE}
                title="Zoom in"
                aria-label="Zoom in"
              >
                <Icon name="zoom-in" />
              </button>
            </div>
          )}
          {numPages !== null && (
            <div className="pdf-viewer-modal__pager">
              <button
                type="button"
                className="pdf-viewer-modal__icon-button"
                onClick={() => setPageNumber((n) => Math.max(1, n - 1))}
                disabled={pageNumber <= 1}
                title="Previous page"
                aria-label="Previous page"
              >
                <Icon name="chevron-left" />
              </button>
              <span className="pdf-viewer-modal__page-counter">
                page {pageNumber} of {numPages}
              </span>
              <button
                type="button"
                className="pdf-viewer-modal__icon-button"
                onClick={() => setPageNumber((n) => Math.min(numPages, n + 1))}
                disabled={pageNumber >= numPages}
                title="Next page"
                aria-label="Next page"
              >
                <Icon name="chevron-right" />
              </button>
            </div>
          )}
          <div className="pdf-viewer-modal__actions">
            {onOpenFull && (
              <button type="button" className="pdf-viewer-modal__action-button" onClick={onOpenFull}>
                Open in full
              </button>
            )}
            {mode !== "content" && (
              <button type="button" className="pdf-viewer-modal__action-button" onClick={handleDownload}>
                <Icon name="download" /> Download original
              </button>
            )}
            {mode === "pdf" && (
              <button
                type="button"
                className="pdf-viewer-modal__action-button"
                onClick={handlePrint}
                disabled={!pdfUrl}
              >
                <Icon name="print" /> Print
              </button>
            )}
            <button
              type="button"
              className="pdf-viewer-modal__icon-button pdf-viewer-modal__close"
              onClick={onClose}
              title="Close"
              aria-label="Close viewer"
            >
              <Icon name="close" />
            </button>
          </div>
        </div>

        {downloadError && <p className="pdf-viewer-modal__error">Download error: {downloadError}</p>}

        {mode === "pdf" && attachmentError && !pdfUrl && (
          <div className="pdf-viewer-modal__error-block">
            <p className="pdf-viewer-modal__error">Failed to read the file: {attachmentError}</p>
            <div className="pdf-viewer-modal__error-actions">
              <button type="button" className="pdf-viewer-modal__action-button" onClick={onRetryAttachment}>
                <Icon name="refresh" /> Retry
              </button>
              <button type="button" className="pdf-viewer-modal__action-button" onClick={handleDownload}>
                <Icon name="download" /> Download original
              </button>
            </div>
          </div>
        )}

        {mode === "pdf" && loadError && (
          <div className="pdf-viewer-modal__error-block">
            <p className="pdf-viewer-modal__error">Failed to open the PDF: {loadError}</p>
            <div className="pdf-viewer-modal__error-actions">
              <button
                type="button"
                className="pdf-viewer-modal__action-button"
                onClick={() => setRetryCount((c) => c + 1)}
              >
                <Icon name="refresh" /> Retry
              </button>
              <button type="button" className="pdf-viewer-modal__action-button" onClick={handleDownload}>
                <Icon name="download" /> Download original
              </button>
            </div>
          </div>
        )}

        <div className={"pdf-viewer-modal__page-area" + (mode === "content" ? " pdf-viewer-modal__page-area--content" : "")}>
          {mode === "content" ? (
            <div className="pdf-viewer-modal__content">{content}</div>
          ) : mode === "image" ? (
            imageUrl && (
              <img
                src={imageUrl}
                alt={title}
                className="pdf-viewer-modal__image"
                style={{ transform: `scale(${scale})` }}
              />
            )
          ) : (
            <>
              {!pdf && !loadError && !attachmentError && <p className="pdf-viewer-modal__hint">Loading…</p>}
              <canvas ref={canvasRef} className="pdf-viewer-modal__canvas" />
            </>
          )}
        </div>
        {mode === "content" && onNavigate && (
          <p className="pdf-viewer-modal__nav-hint" aria-hidden="true">
            ← → — neighboring materials in the section
          </p>
        )}
      </div>
    </div>
  );
}
