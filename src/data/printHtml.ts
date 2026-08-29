import type { EditorJsBlock, EditorJsListItem, EditorJsOutputData } from "./types";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ALERT_LABELS: Record<string, string> = {
  primary: "Take note",
  secondary: "Note",
  info: "Info",
  success: "Good",
  warning: "Warning",
  danger: "Danger",
  light: "Note",
  dark: "Note",
};

function renderListItems(items: EditorJsListItem[], style: string): string {
  const tag = style === "ordered" ? "ol" : "ul";
  const cls = style === "checklist" ? ' class="print-list print-list--checklist"' : ' class="print-list"';
  const rendered = items
    .map((item) => {
      const nested = item.items.length > 0 ? renderListItems(item.items, style) : "";
      const box = style === "checklist" ? '<span class="print-checkbox"></span>' : "";
      return `<li>${box}<span>${item.content}</span>${nested}</li>`;
    })
    .join("");
  return `<${tag}${cls}>${rendered}</${tag}>`;
}

export function blockToPrintHtml(block: EditorJsBlock, imageUrls: Record<string, string> = {}): string {
  switch (block.type) {
    case "header": {
      const level = Math.min(Math.max(block.data.level, 1), 6);
      return `<h${level} class="print-header">${block.data.text}</h${level}>`;
    }
    case "paragraph":
      return `<p class="print-paragraph">${block.data.text}</p>`;
    case "list":
      return renderListItems(block.data.items, block.data.style);
    case "quote": {
      const caption = block.data.caption ? `<cite>${block.data.caption}</cite>` : "";
      return `<blockquote class="print-quote"><p>${block.data.text}</p>${caption}</blockquote>`;
    }
    case "alert": {
      const label = ALERT_LABELS[block.data.type] ?? "Take note";
      return (
        `<div class="print-alert print-alert--${escapeHtml(block.data.type)}">` +
        `<span class="print-alert__label">${escapeHtml(label)}</span>` +
        `<div class="print-alert__text">${block.data.text}</div></div>`
      );
    }
    case "table": {
      const rows = block.data.content ?? [];
      const withHeadings = block.data.withHeadings === true;
      const body = rows
        .map((row, index) => {
          const cellTag = withHeadings && index === 0 ? "th" : "td";
          return `<tr>${row.map((cell) => `<${cellTag}>${cell}</${cellTag}>`).join("")}</tr>`;
        })
        .join("");
      return `<table class="print-table">${body}</table>`;
    }
    case "image": {
      const key = block.data.file?.key ?? "";
      const url = imageUrls[key];
      const caption = block.data.caption ? `<figcaption>${block.data.caption}</figcaption>` : "";
      if (!url) {
        return `<figure class="print-figure print-figure--missing"><p>[image not found]</p>${caption}</figure>`;
      }
      return `<figure class="print-figure"><img src="${escapeHtml(url)}" alt="${escapeHtml(
        block.data.caption ?? "",
      )}">${caption}</figure>`;
    }
    case "attaches": {
      const title = block.data.title || block.data.file?.name || "file";
      return `<p class="print-attach">Attached file: ${escapeHtml(title)}</p>`;
    }
    default:
      return "";
  }
}

export function collectImageAttachmentKeys(data: EditorJsOutputData): string[] {
  const keys: string[] = [];
  for (const block of data.blocks) {
    if (block.type === "image") {
      const key = block.data.file?.key;
      if (key) keys.push(key);
    }
  }
  return keys;
}

export const PRINT_BODY_CSS = `
  @page { size: A4 portrait; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #fff;
    color: #000;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11.5pt;
    line-height: 1.45;
  }
  .print-doc__title {
    margin: 0 0 2mm;
    font-size: 18pt;
    line-height: 1.2;
  }
  .print-doc__meta {
    margin: 0 0 6mm;
    padding-bottom: 2mm;
    border-bottom: 1px solid #000;
    font-size: 9pt;
    color: #333;
  }
  .print-header {
    margin: 6mm 0 2mm;
    line-height: 1.25;
    break-after: avoid;
    page-break-after: avoid;
    break-inside: avoid;
  }
  .print-paragraph { margin: 0 0 3mm; orphans: 3; widows: 3; }
  .print-list { margin: 0 0 3mm; padding-left: 7mm; }
  .print-list li { margin-bottom: 1.5mm; }
  .print-list--checklist { list-style: none; padding-left: 2mm; }
  .print-checkbox {
    display: inline-block;
    width: 3.6mm;
    height: 3.6mm;
    margin-right: 2mm;
    border: 0.4mm solid #000;
    vertical-align: -0.4mm;
  }
  .print-quote {
    margin: 0 0 3mm;
    padding-left: 4mm;
    border-left: 0.6mm solid #000;
    font-style: italic;
    break-inside: avoid;
  }
  .print-quote cite { display: block; margin-top: 1mm; font-size: 9.5pt; font-style: normal; }
  .print-alert {
    margin: 0 0 3mm;
    padding: 2.5mm 3mm;
    border: 0.4mm solid #000;
    break-inside: avoid;
  }
  .print-alert__label {
    display: block;
    margin-bottom: 1mm;
    font-family: Arial, sans-serif;
    font-size: 8.5pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .print-table {
    width: 100%;
    margin: 0 0 4mm;
    border-collapse: collapse;
    font-size: 10pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .print-table th, .print-table td {
    padding: 1.5mm 2mm;
    border: 0.3mm solid #000;
    text-align: left;
    vertical-align: top;
  }
  .print-table th { font-weight: bold; background: #eee; }
  .print-figure { margin: 0 0 4mm; break-inside: avoid; page-break-inside: avoid; }
  .print-figure img { display: block; max-width: 100%; height: auto; }
  .print-figure figcaption { margin-top: 1mm; font-size: 9.5pt; color: #333; }
  .print-figure--missing p { padding: 4mm; border: 0.3mm dashed #000; color: #333; text-align: center; }
  .print-attach { margin: 0 0 3mm; font-size: 10pt; }
  a { color: #000; text-decoration: underline; }
`;

export interface PrintDocumentOptions {
  title: string;
  meta?: string;
  imageUrls?: Record<string, string>;
  sections?: { heading: string; data: EditorJsOutputData }[];
  data?: EditorJsOutputData;
}

export function buildPrintDocument(options: PrintDocumentOptions): string {
  const { title, meta, imageUrls = {} } = options;
  const parts = options.sections ?? (options.data ? [{ heading: "", data: options.data }] : []);

  const body = parts
    .map((part) => {
      const heading = part.heading ? `<h2 class="print-header">${escapeHtml(part.heading)}</h2>` : "";
      return heading + part.data.blocks.map((block) => blockToPrintHtml(block, imageUrls)).join("\n");
    })
    .join("\n");

  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    `<title>${escapeHtml(title)}</title>` +
    `<style>${PRINT_BODY_CSS}</style></head><body>` +
    `<h1 class="print-doc__title">${escapeHtml(title)}</h1>` +
    (meta ? `<p class="print-doc__meta">${escapeHtml(meta)}</p>` : "") +
    body +
    "</body></html>"
  );
}
