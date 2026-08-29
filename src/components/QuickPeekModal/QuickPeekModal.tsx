import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Material, MaterialSummary } from "../../data/types";
import { downloadMaterialOriginal, getMaterialAttachmentUrl, getMaterialById } from "../../data/repository";
import { createObjectUrlTracker } from "../../data/objectUrlTracker";
import PdfViewerModal from "../PdfViewerModal/PdfViewerModal";
import BlockRenderer from "../BlockRenderer/BlockRenderer";
import "./QuickPeekModal.css";

export default function QuickPeekModal({
  materials,
  initialIndex,
  onClose,
}: {
  materials: MaterialSummary[];
  initialIndex: number;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(initialIndex);
  const [material, setMaterial] = useState<Material | null | undefined>(undefined);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const trackerRef = useRef(createObjectUrlTracker());

  const summary = materials[index];

  useEffect(() => {
    if (!summary) return;
    let cancelled = false;
    setMaterial(undefined);
    setPdfUrl(null);
    getMaterialById(summary._id).then((doc) => {
      if (!cancelled) setMaterial(doc ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [summary]);

  useEffect(() => {
    if (!material || (material.type !== "form" && material.type !== "presentation")) return;
    let cancelled = false;
    const tracker = trackerRef.current;
    getMaterialAttachmentUrl(material._id, material.file.pdf.attachment).then((url) => {
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      setPdfUrl(tracker.track(url));
    });
    return () => {
      cancelled = true;
      tracker.revokeAll();
    };
  }, [material]);

  function handleNavigate(direction: "prev" | "next") {
    setIndex((current) => {
      const next = direction === "prev" ? current - 1 : current + 1;
      if (next < 0 || next >= materials.length) return current; // section boundaries — no wrap-around
      return next;
    });
  }

  function handleOpenFull() {
    if (!summary) return;
    onClose();
    navigate(`/material/${encodeURIComponent(summary._id)}`);
  }

  async function downloadOriginal() {
    if (!summary) return false;
    return downloadMaterialOriginal(summary._id);
  }

  if (!summary) return null;

  const canNavigate = materials.length > 1;

  if (material === undefined) {
    return (
      <PdfViewerModal
        isOpen
        title={summary.title}
        mode="content"
        content={<p className="quick-peek-modal__hint">Loading…</p>}
        onOpenFull={handleOpenFull}
        onNavigate={canNavigate ? handleNavigate : undefined}
        onClose={onClose}
        onDownloadOriginal={downloadOriginal}
      />
    );
  }

  if (material === null) {
    return (
      <PdfViewerModal
        isOpen
        title={summary.title}
        mode="content"
        content={<p className="quick-peek-modal__hint">Material not found.</p>}
        onOpenFull={handleOpenFull}
        onNavigate={canNavigate ? handleNavigate : undefined}
        onClose={onClose}
        onDownloadOriginal={downloadOriginal}
      />
    );
  }

  if (material.type === "form" || material.type === "presentation") {
    return (
      <PdfViewerModal
        isOpen
        title={material.title}
        mode="pdf"
        pdfUrl={pdfUrl}
        onOpenFull={handleOpenFull}
        onNavigate={canNavigate ? handleNavigate : undefined}
        onClose={onClose}
        onDownloadOriginal={downloadOriginal}
      />
    );
  }

  const body =
    material.type === "article" ? (
      <BlockRenderer data={material.body} materialId={material._id} interactiveChecklists={false} />
    ) : (
      <>
        <h2 className="quick-peek-modal__subheading">Introduction (before the screening)</h2>
        <BlockRenderer data={material.intro} materialId={material._id} interactiveChecklists={false} />
        <h2 className="quick-peek-modal__subheading">Discussion questions (after the screening)</h2>
        <BlockRenderer data={material.questions} materialId={material._id} interactiveChecklists={false} />
      </>
    );

  return (
    <PdfViewerModal
      isOpen
      title={material.title}
      mode="content"
      content={body}
      onOpenFull={handleOpenFull}
      onNavigate={canNavigate ? handleNavigate : undefined}
      onClose={onClose}
      onDownloadOriginal={downloadOriginal}
    />
  );
}
