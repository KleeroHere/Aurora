import { useRef } from "react";
import { requestPrintPreview } from "../../data/printPreviewBus";
import Icon from "../icons/Icon";
import FigureCards from "./FigureCards";
import FigurePyramid from "./FigurePyramid";
import FigureTable from "./FigureTable";
import { findMaterialFigure } from "./materialFigures";
import brandLogo from "../../assets/brand/aurora-mark.png?inline";
import figureCss from "./MaterialFigure.css?raw";
import "./MaterialFigure.css";

const PRINT_STYLE = `
  @page { size: %ORIENTATION%; margin: 12mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: "Onest", -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
  .material-figure {
    --figure-surface: #ffffff;
    --figure-ink: #000000;
    --figure-ink-muted: #000000;
    --figure-line: #000000;
    --figure-head-bg: #ffffff;
    --figure-head-ink: #000000;
    --figure-zebra: transparent;
    --figure-accent: #000000;
    --color-border: #000000;
    --color-text-on-accent: #000000;
    margin: 0;
    padding: 0;
    border: none;
    box-shadow: none;
  }
  .material-figure__actions { display: none; }
  .material-figure__logo { filter: none !important; opacity: 1; }
  .figure-table { min-width: 0; }
  .figure-cards__card { break-inside: avoid; border-left: 2px solid #000; background: #fff; }
  .figure-table__grid line, .figure-table__grid rect, .figure-table__grid polygon { stroke-width: 1.2; }
`;

export default function MaterialFigure({ materialId }: { materialId: string }) {
  const entry = findMaterialFigure(materialId);
  const figureRef = useRef<HTMLElement>(null);

  if (!entry) return null;
  const { spec, orientation } = entry;

  function handlePrint() {
    const node = figureRef.current;
    if (!node) return;
    const html =
      "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
      `<title>${spec.caption}</title><style>${figureCss}</style>` +
      `<style>${PRINT_STYLE.replace("%ORIENTATION%", `A4 ${orientation}`)}</style>` +
      `</head><body>${node.outerHTML}</body></html>`;
    requestPrintPreview({ kind: "html", html, title: spec.caption, landscape: orientation === "landscape" });
  }

  return (
    <figure className="material-figure" ref={figureRef} data-help="material-figure">
      <div className="material-figure__header">
        <figcaption className="material-figure__caption">{spec.caption}</figcaption>
        <img className="material-figure__logo" src={brandLogo} alt="" aria-hidden="true" />
      </div>

      <div className="material-figure__body">
        {spec.kind === "table" && <FigureTable spec={spec} />}
        {spec.kind === "pyramid" && <FigurePyramid spec={spec} />}
        {spec.kind === "cards" && <FigureCards spec={spec} />}
      </div>

      <div className="material-figure__actions">
        <button type="button" className="material-figure__print" onClick={handlePrint}>
          <Icon name="print" /> Print (black-and-white version)
        </button>
      </div>
    </figure>
  );
}
