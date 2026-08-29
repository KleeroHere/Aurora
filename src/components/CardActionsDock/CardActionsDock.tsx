import type { MouseEvent } from "react";
import type { MaterialType } from "../../data/types";
import { buildMaterialPrintHtml, getMaterialPdfUrl } from "../../data/repository";
import { requestPrintPreview } from "../../data/printPreviewBus";
import { showToast } from "../../data/toastBus";
import PinButton from "../PinButton/PinButton";
import Icon from "../icons/Icon";
import "./CardActionsDock.css";
import { humanError } from "../../utils/humanText";

const PRINTABLE_TYPES: MaterialType[] = ["form", "presentation", "article", "film"];

const PDF_PRINTABLE_TYPES: MaterialType[] = ["form", "presentation"];

export default function CardActionsDock({
  materialId,
  title,
  type,
  onQuickPeek,
}: {
  materialId: string;
  title: string;
  type: MaterialType;
  onQuickPeek?: () => void;
}) {
  function stop(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  async function handlePrint(event: MouseEvent) {
    stop(event);
    try {
      if (!PDF_PRINTABLE_TYPES.includes(type)) {
        const prepared = await buildMaterialPrintHtml(materialId);
        if (!prepared) {
          showToast({ message: "Material not found", role: "error" });
          return;
        }
        requestPrintPreview({ kind: "html", html: prepared.html, title: prepared.title });
        return;
      }
      const pdfUrl = await getMaterialPdfUrl(materialId);
      requestPrintPreview({ pdfUrl, title, ownsUrl: true });
    } catch (err) {
      showToast({
        message: `Failed to prepare the file for printing: ${humanError(err)}`,
        role: "error",
      });
    }
  }

  async function handleCopyLink(event: MouseEvent) {
    stop(event);
    const url = `${window.location.origin}${window.location.pathname}#/material/${encodeURIComponent(materialId)}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast({
        message: "Link copied. It opens the material inside the app, not on the internet.",
        role: "success",
      });
    } catch (err) {
      showToast({
        message: `Failed to copy the link: ${humanError(err)}`,
        role: "error",
      });
    }
  }

  function handleQuickPeek(event: MouseEvent) {
    stop(event);
    onQuickPeek?.();
  }

  return (
    <div className="card-actions-dock" onClick={(e) => e.preventDefault()} data-help="card-actions">
      {PRINTABLE_TYPES.includes(type) && (
        <button
          type="button"
          className="card-actions-dock__button"
          onClick={handlePrint}
          title="Print"
          aria-label={`Print: ${title}`}
        >
          <Icon name="print" size={14} />
        </button>
      )}
      <PinButton materialId={materialId} variant="icon" />
      <button
        type="button"
        className="card-actions-dock__button"
        onClick={handleCopyLink}
        title="Copy link to material"
        aria-label={`Copy link: ${title}`}
      >
        <Icon name="link" size={14} />
      </button>
      {onQuickPeek && (
        <button
          type="button"
          className="card-actions-dock__button"
          onClick={handleQuickPeek}
          title="Quick peek (space)"
          aria-label={`Quick peek: ${title}`}
        >
          <Icon name="zoom-in" size={14} />
        </button>
      )}
    </div>
  );
}
