import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { loadPdfDocument } from "../../data/pdf";
import type { PdfDocumentHandle } from "../../data/pdf";
import { isHtmlPrintRequest, onPrintPreviewRequest } from "../../data/printPreviewBus";
import type { PrintRequest } from "../../data/printPreviewBus";
import { createOwnedUrlSlot } from "../../data/ownedUrlSlot";
import { shouldSkipPrintPreview, setSkipPrintPreview } from "../../utils/printPreviewSettings";
import { useFocusTrap } from "../../utils/useFocusTrap";
import Icon from "../icons/Icon";
import "./PrintPreviewModal.css";
import { humanError } from "../../utils/humanText";

const PREVIEW_SCALE = 1.3;

export default function PrintPreviewModal() {
  const [request, setRequest] = useState<PrintRequest | null>(null);
  const [pdf, setPdf] = useState<PdfDocumentHandle | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const printFrameRef = useRef<HTMLIFrameElement>(null);
  const ownedUrlRef = useRef(createOwnedUrlSlot());

  const isOpen = request !== null;
  useFocusTrap(panelRef, isOpen);

  function printViaHiddenFrame(req: PrintRequest) {
    const frame = printFrameRef.current;
    if (!frame) return;
    function handleLoad() {
      frame!.contentWindow?.print();
      frame!.removeEventListener("load", handleLoad);
    }
    frame.addEventListener("load", handleLoad);
    if (isHtmlPrintRequest(req)) frame.srcdoc = req.html;
    else frame.src = req.pdfUrl;
  }

  useEffect(() => {
    const ownedUrl = ownedUrlRef.current;
    return onPrintPreviewRequest((req) => {
      if (!isHtmlPrintRequest(req) && req.ownsUrl) {
        ownedUrl.adopt(req.pdfUrl);
      } else {
        ownedUrl.release();
      }

      if (shouldSkipPrintPreview()) {
        printViaHiddenFrame(req);
        return;
      }
      setRequest(req);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ownedUrl = ownedUrlRef.current;
    return () => ownedUrl.release();
  }, []);

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    let loadedDoc: PdfDocumentHandle | null = null;
    setPdf(null);
    setPageNumber(1);
    setLoadError(null);
    if (isHtmlPrintRequest(request)) return;
    loadPdfDocument(request.pdfUrl)
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
  }, [request]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    const canvas = canvasRef.current;
    pdf.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale: PREVIEW_SCALE });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) return;
      page.render({ canvasContext: context, viewport, canvas });
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber]);

  function close() {
    setRequest(null);
  }

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) close();
  }

  function handlePrintNow() {
    if (!request) return;
    printViaHiddenFrame(request);
    close();
  }

  function handlePrintWithoutPreviewNextTime() {
    if (!request) return;
    setSkipPrintPreview(true);
    printViaHiddenFrame(request);
    close();
  }

  const isHtml = request !== null && isHtmlPrintRequest(request);
  const numPages = pdf?.numPages ?? null;

  return (
    <>
      <iframe ref={printFrameRef} title="" className="print-preview-modal__print-frame" />

      {isOpen && (
        <div
          className="print-preview-modal"
          data-help="print-preview"
          role="dialog"
          aria-modal="true"
          aria-label={`Print preview: ${request!.title}`}
          onClick={handleBackdropClick}
        >
          <div className="print-preview-modal__panel surface-glass-blur" ref={panelRef}>
            <div className="print-preview-modal__toolbar">
              <p className="print-preview-modal__title" title={request!.title}>
                {request!.title}
              </p>
              {!isHtml && numPages !== null && numPages > 1 && (
                <div className="print-preview-modal__pager">
                  <button
                    type="button"
                    className="print-preview-modal__icon-button"
                    onClick={() => setPageNumber((n) => Math.max(1, n - 1))}
                    disabled={pageNumber <= 1}
                    title="Previous page"
                    aria-label="Previous page"
                  >
                    <Icon name="chevron-left" />
                  </button>
                  <span className="print-preview-modal__page-counter">
                    page {pageNumber} of {numPages}
                  </span>
                  <button
                    type="button"
                    className="print-preview-modal__icon-button"
                    onClick={() => setPageNumber((n) => Math.min(numPages, n + 1))}
                    disabled={pageNumber >= numPages}
                    title="Next page"
                    aria-label="Next page"
                  >
                    <Icon name="chevron-right" />
                  </button>
                </div>
              )}
              <button
                type="button"
                className="print-preview-modal__icon-button print-preview-modal__close"
                onClick={close}
                title="Close"
                aria-label="Close preview"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="print-preview-modal__stage">
              {loadError ? (
                <p className="print-preview-modal__error">Failed to open the file: {loadError}</p>
              ) : isHtml ? (
                <div
                  className={
                    (request as { landscape?: boolean }).landscape
                      ? "print-preview-modal__sheet print-preview-modal__sheet--landscape"
                      : "print-preview-modal__sheet"
                  }
                >
                  <iframe
                    className="print-preview-modal__html"
                    title={`Preview: ${request!.title}`}
                    srcDoc={(request as { html: string }).html}
                  />
                </div>
              ) : (
                <div className="print-preview-modal__sheet">
                  {!pdf && <p className="print-preview-modal__hint">Loading…</p>}
                  <canvas ref={canvasRef} className="print-preview-modal__canvas" />
                </div>
              )}
            </div>

            <div className="print-preview-modal__actions">
              <button
                type="button"
                className="print-preview-modal__button print-preview-modal__button--secondary"
                onClick={handlePrintWithoutPreviewNextTime}
              >
                Print without preview (remember this choice)
              </button>
              <button type="button" className="print-preview-modal__button" onClick={handlePrintNow} disabled={!pdf}>
                <Icon name="print" /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
