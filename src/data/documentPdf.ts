/**
 * Multi-page PDF generator for seeded demo documents: printable forms
 * (portrait Letter) and slide decks (landscape). Pure TypeScript, no
 * dependencies — only base PDF operators (re/f/S, m/l/S, BT..ET, rg/RG)
 * and the standard Type1 Helvetica faces, so the output opens in the
 * app's pdf.js viewer as well as any desktop reader.
 */

export interface PdfFieldRow {
  label: string;
  /** How many ruled lines to draw for the handwritten answer (default 1). */
  lines?: number;
}

export interface PdfFormSpec {
  kind: "form";
  title: string;
  subtitle?: string;
  intro?: string[];
  fields?: PdfFieldRow[];
  checkboxes?: string[];
  table?: { headers: string[]; rows: number };
  signatures?: string[];
  footer?: string;
}

export interface PdfSlidesSpec {
  kind: "slides";
  title: string;
  subtitle?: string;
  slides: { heading: string; bullets: string[] }[];
  footer?: string;
}

export type PdfDocumentSpec = PdfFormSpec | PdfSlidesSpec;

// ---------------------------------------------------------------------------
// Text handling: ASCII sanitation, escaping, Helvetica metrics
// ---------------------------------------------------------------------------

/**
 * The built-in Helvetica here is limited to WinAnsi, and the seeds are
 * English, so anything outside ASCII is folded to a readable ASCII stand-in
 * (dashes, smart quotes, ellipsis, accented letters) instead of breaking
 * the text layer.
 */
const ASCII_REPLACEMENTS: [RegExp, string][] = [
  [/[‐‑‒–—―−]/g, "-"], // hyphens, en/em dash, minus
  [/[‘’‚′]/g, "'"], // smart single quotes, prime
  [/[“”„″«»]/g, '"'], // smart double quotes, guillemets
  [/…/g, "..."], // ellipsis
  [/[  -  　]/g, " "], // non-breaking and typographic spaces
  [/[•·●▪◦]/g, "-"], // bullet marks
  [/→/g, "->"], // right arrow
  [/←/g, "<-"], // left arrow
  [/×/g, "x"], // multiplication sign
  [/÷/g, "/"], // division sign
];

function toAscii(text: string): string {
  let out = text;
  for (const [pattern, replacement] of ASCII_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  // Decompose accented letters (e.g. e-acute -> e + combining mark), drop the
  // marks, then replace whatever non-ASCII survives with a visible placeholder.
  out = out.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return out.replace(/[^ -~]/g, "?");
}

// Same escaping as createPlaceholderPdf in binary.ts; duplicated on purpose
// so this module stays self-contained.
function pdfEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// AFM advance widths (1/1000 em) for characters 32..126.
const HELVETICA_WIDTHS = (
  "278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 " +
  "556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 " +
  "1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 " +
  "667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 " +
  "333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 " +
  "556 556 333 500 278 556 500 722 500 500 500 334 260 334 584"
).split(" ").map(Number);

const HELVETICA_BOLD_WIDTHS = (
  "278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 " +
  "556 556 556 556 556 556 556 556 556 556 333 333 584 584 584 611 " +
  "975 722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 " +
  "667 778 722 667 611 722 667 944 667 667 611 333 278 333 584 556 " +
  "333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 " +
  "611 611 389 556 333 611 556 778 556 556 500 389 280 389 584"
).split(" ").map(Number);

type FontName = "F1" | "F2"; // F1 = Helvetica, F2 = Helvetica-Bold

function textWidth(text: string, size: number, font: FontName): number {
  const widths = font === "F2" ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  let units = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    units += code >= 32 && code <= 126 ? widths[code - 32] : 556;
  }
  return (units / 1000) * size;
}

/** Greedy word wrap against real Helvetica metrics. */
function wrapText(text: string, size: number, font: FontName, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (textWidth(candidate, size, font) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

// ---------------------------------------------------------------------------
// Low-level page builder
// ---------------------------------------------------------------------------

const fmt = (n: number): string => {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

type Rgb = [number, number, number];

const NAVY: Rgb = [0.16, 0.2, 0.3];
const HEADER_MUTED: Rgb = [0.72, 0.76, 0.85];
const INK: Rgb = [0.2, 0.2, 0.22];
const BODY: Rgb = [0.25, 0.25, 0.27];
const LABEL_GRAY: Rgb = [0.45, 0.45, 0.48];
const FAINT_GRAY: Rgb = [0.55, 0.55, 0.58];
const RULE_GRAY: Rgb = [0.72, 0.72, 0.75];
const TABLE_FILL: Rgb = [0.92, 0.93, 0.94];
const WHITE: Rgb = [1, 1, 1];

class PageBuilder {
  private ops: string[] = [];

  constructor(readonly width: number, readonly height: number) {}

  /** `raw` must already be sanitized; escaping happens here. */
  private textRaw(x: number, y: number, raw: string, size: number, font: FontName, color: Rgb): void {
    const [r, g, b] = color;
    this.ops.push(
      `BT /${font} ${fmt(size)} Tf ${fmt(r)} ${fmt(g)} ${fmt(b)} rg ` +
        `${fmt(x)} ${fmt(y)} Td (${pdfEscape(raw)}) Tj ET`,
    );
  }

  text(x: number, y: number, value: string, size: number, font: FontName, color: Rgb): void {
    this.textRaw(x, y, toAscii(value), size, font, color);
  }

  textRight(rightX: number, y: number, value: string, size: number, font: FontName, color: Rgb): void {
    const ascii = toAscii(value);
    this.textRaw(rightX - textWidth(ascii, size, font), y, ascii, size, font, color);
  }

  textCenter(centerX: number, y: number, value: string, size: number, font: FontName, color: Rgb): void {
    const ascii = toAscii(value);
    this.textRaw(centerX - textWidth(ascii, size, font) / 2, y, ascii, size, font, color);
  }

  /** Round WinAnsi bullet glyph (code 149), for slide bullets. */
  bullet(x: number, y: number, size: number, color: Rgb): void {
    const [r, g, b] = color;
    this.ops.push(
      `BT /F1 ${fmt(size)} Tf ${fmt(r)} ${fmt(g)} ${fmt(b)} rg ${fmt(x)} ${fmt(y)} Td (\\225) Tj ET`,
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, width: number, color: Rgb): void {
    const [r, g, b] = color;
    this.ops.push(
      `${fmt(width)} w ${fmt(r)} ${fmt(g)} ${fmt(b)} RG ` +
        `${fmt(x1)} ${fmt(y1)} m ${fmt(x2)} ${fmt(y2)} l S`,
    );
  }

  fillRect(x: number, y: number, w: number, h: number, color: Rgb): void {
    const [r, g, b] = color;
    this.ops.push(`${fmt(r)} ${fmt(g)} ${fmt(b)} rg ${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re f`);
  }

  strokeRect(x: number, y: number, w: number, h: number, width: number, color: Rgb): void {
    const [r, g, b] = color;
    this.ops.push(
      `${fmt(width)} w ${fmt(r)} ${fmt(g)} ${fmt(b)} RG ` +
        `${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re S`,
    );
  }

  contentStream(): string {
    return this.ops.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Document assembly (catalog, pages, fonts, xref)
// ---------------------------------------------------------------------------

function assemblePdf(pages: PageBuilder[]): Uint8Array {
  // Object layout: 1 catalog, 2 pages, 3 F1, 4 F2, then page/content pairs.
  const pageObjNumber = (i: number): number => 5 + i * 2;
  const kids = pages.map((_, i) => `${pageObjNumber(i)} 0 R`).join(" ");

  const objects: string[] = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`,
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n",
  ];

  pages.forEach((page, i) => {
    const num = pageObjNumber(i);
    const stream = page.contentStream();
    objects.push(
      `${num} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${num + 1} 0 R >>\nendobj\n`,
    );
    objects.push(`${num + 1} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  });

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(body.length);
    body += obj;
  }

  const xrefStart = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(body + xref + trailer);
}

// ---------------------------------------------------------------------------
// Form layout (portrait Letter)
// ---------------------------------------------------------------------------

const FORM_W = 612;
const FORM_H = 792;
const FORM_MARGIN = 54;
const FORM_CONTENT_W = FORM_W - FORM_MARGIN * 2;
const FORM_BOTTOM = 64; // content never goes below this; footer sits underneath
const HEADER_BAND_H = 84;

/** Flows form blocks down the page, breaking to continuation pages as needed. */
class FormComposer {
  readonly pages: PageBuilder[] = [];
  page!: PageBuilder;
  y = 0;

  constructor(private readonly title: string) {
    this.startFirstPage();
  }

  private startFirstPage(): void {
    this.page = new PageBuilder(FORM_W, FORM_H);
    this.pages.push(this.page);
    this.page.fillRect(0, FORM_H - HEADER_BAND_H, FORM_W, HEADER_BAND_H, NAVY);
    this.y = FORM_H - HEADER_BAND_H - 30;
  }

  drawFirstPageHeaderText(subtitle: string | undefined): void {
    const first = this.pages[0];
    if (subtitle) {
      first.text(FORM_MARGIN, FORM_H - 39, this.title, 19, "F2", WHITE);
      first.text(FORM_MARGIN, FORM_H - 62, subtitle, 10.5, "F1", HEADER_MUTED);
    } else {
      first.text(FORM_MARGIN, FORM_H - 50, this.title, 19, "F2", WHITE);
    }
  }

  private startContinuationPage(): void {
    this.page = new PageBuilder(FORM_W, FORM_H);
    this.pages.push(this.page);
    this.page.text(FORM_MARGIN, FORM_H - 34, this.title, 8, "F1", FAINT_GRAY);
    this.page.line(FORM_MARGIN, FORM_H - 42, FORM_W - FORM_MARGIN, FORM_H - 42, 0.75, RULE_GRAY);
    this.y = FORM_H - 70;
  }

  /** Break to a new page unless `height` fits above the footer area. */
  ensure(height: number): void {
    if (this.y - height < FORM_BOTTOM) this.startContinuationPage();
  }

  /** Break to a new page if the cursor has already descended past `minY`. */
  ensureAbove(minY: number): void {
    if (this.y < minY) this.startContinuationPage();
  }
}

function layoutForm(spec: PdfFormSpec): PageBuilder[] {
  const c = new FormComposer(spec.title);
  c.drawFirstPageHeaderText(spec.subtitle);

  if (spec.intro && spec.intro.length > 0) {
    for (const paragraphLine of spec.intro) {
      const lines = wrapText(toAscii(paragraphLine), 10.5, "F1", FORM_CONTENT_W);
      for (const line of lines) {
        c.ensure(15);
        c.page.text(FORM_MARGIN, c.y, line, 10.5, "F1", BODY);
        c.y -= 15;
      }
    }
    c.y -= 10;
  }

  for (const field of spec.fields ?? []) {
    const ruleCount = Math.max(1, field.lines ?? 1);
    // Keep the label together with its first ruled line.
    c.ensure(12 + 24);
    c.page.text(FORM_MARGIN, c.y, field.label, 8.5, "F1", LABEL_GRAY);
    c.y -= 22;
    for (let i = 0; i < ruleCount; i++) {
      if (i > 0) {
        c.ensure(24);
      }
      c.page.line(FORM_MARGIN, c.y, FORM_W - FORM_MARGIN, c.y, 0.75, RULE_GRAY);
      c.y -= 24;
    }
    c.y -= 4;
  }

  if (spec.checkboxes && spec.checkboxes.length > 0) {
    c.y -= 2;
    for (const item of spec.checkboxes) {
      const lines = wrapText(toAscii(item), 10.5, "F1", FORM_CONTENT_W - 18);
      c.ensure(12 + (lines.length - 1) * 14);
      c.page.strokeRect(FORM_MARGIN, c.y - 1.5, 10, 10, 0.9, [0.35, 0.35, 0.4]);
      lines.forEach((line, i) => {
        c.page.text(FORM_MARGIN + 18, c.y - i * 14, line, 10.5, "F1", BODY);
      });
      c.y -= 22 + (lines.length - 1) * 14;
    }
    c.y -= 4;
  }

  if (spec.table && spec.table.headers.length > 0 && spec.table.rows > 0) {
    drawFormTable(c, spec.table.headers, spec.table.rows);
  }

  if (spec.signatures && spec.signatures.length > 0) {
    drawSignatures(c, spec.signatures);
  }

  // Footer and page numbers go on every page, once the page count is known.
  const total = c.pages.length;
  c.pages.forEach((page, i) => {
    if (spec.footer) {
      page.textCenter(FORM_W / 2, 34, spec.footer, 7.5, "F1", FAINT_GRAY);
    }
    page.textRight(FORM_W - FORM_MARGIN, 34, `Page ${i + 1} of ${total}`, 7.5, "F1", FAINT_GRAY);
  });

  return c.pages;
}

/** Empty ruled table; splits across pages, repeating the shaded header row. */
function drawFormTable(c: FormComposer, headers: string[], totalRows: number): void {
  const headH = 24;
  const rowH = 26;
  const colW = FORM_CONTENT_W / headers.length;
  let remaining = totalRows;

  while (remaining > 0) {
    // Need the header plus at least one row to make a segment worth drawing.
    c.ensure(headH + rowH);
    const top = c.y;
    const fit = Math.floor((top - headH - FORM_BOTTOM) / rowH);
    const count = Math.min(remaining, Math.max(1, fit));
    const bottom = top - headH - count * rowH;

    c.page.fillRect(FORM_MARGIN, top - headH, FORM_CONTENT_W, headH, TABLE_FILL);
    headers.forEach((header, i) => {
      c.page.text(FORM_MARGIN + i * colW + 7, top - 16, header, 9.5, "F2", INK);
    });
    c.page.line(FORM_MARGIN, top - headH, FORM_W - FORM_MARGIN, top - headH, 0.9, [0.6, 0.6, 0.63]);
    for (let r = 1; r < count; r++) {
      const yy = top - headH - r * rowH;
      c.page.line(FORM_MARGIN, yy, FORM_W - FORM_MARGIN, yy, 0.6, RULE_GRAY);
    }
    for (let i = 1; i < headers.length; i++) {
      const xx = FORM_MARGIN + i * colW;
      c.page.line(xx, top, xx, bottom, 0.6, RULE_GRAY);
    }
    c.page.strokeRect(FORM_MARGIN, bottom, FORM_CONTENT_W, top - bottom, 0.9, [0.6, 0.6, 0.63]);

    remaining -= count;
    c.y = bottom - 20;
  }
}

/** Signature lines anchored near the bottom of the last page, side by side. */
function drawSignatures(c: FormComposer, signatures: string[]): void {
  const lineY = 96;
  // Break first if the flowed content already reaches the signature area.
  c.ensureAbove(lineY + 34);
  const gap = 24;
  const colW = (FORM_CONTENT_W - gap * (signatures.length - 1)) / signatures.length;
  signatures.forEach((name, i) => {
    const x = FORM_MARGIN + i * (colW + gap);
    c.page.line(x, lineY, x + colW, lineY, 0.9, [0.35, 0.35, 0.4]);
    c.page.text(x, lineY - 13, name, 8, "F2", BODY);
    c.page.text(x, lineY - 25, "signature / date", 7.5, "F1", FAINT_GRAY);
  });
}

// ---------------------------------------------------------------------------
// Slides layout (landscape)
// ---------------------------------------------------------------------------

const SLIDE_W = 792;
const SLIDE_H = 612;
const SLIDE_MARGIN = 64;

function layoutSlides(spec: PdfSlidesSpec): PageBuilder[] {
  const pages: PageBuilder[] = [];

  // Title page: accent band on the left, big title mid-page.
  const title = new PageBuilder(SLIDE_W, SLIDE_H);
  pages.push(title);
  title.fillRect(0, 0, 18, SLIDE_H, NAVY);
  const titleLines = wrapText(toAscii(spec.title), 30, "F2", SLIDE_W - 80 - SLIDE_MARGIN);
  let titleY = 340 + (titleLines.length - 1) * 19;
  for (const line of titleLines) {
    title.text(80, titleY, line, 30, "F2", INK);
    titleY -= 38;
  }
  title.fillRect(80, titleY + 18, 120, 3, NAVY);
  if (spec.subtitle) {
    title.text(80, titleY - 6, spec.subtitle, 13, "F1", LABEL_GRAY);
  }
  if (spec.footer) {
    title.text(80, 40, spec.footer, 8.5, "F1", FAINT_GRAY);
  }

  const totalSlides = spec.slides.length;
  spec.slides.forEach((slide, index) => {
    let page = startSlidePage(pages, slide.heading, spec.footer, index + 1, totalSlides);
    let y = 452;
    for (const bulletText of slide.bullets) {
      const lines = wrapText(toAscii(bulletText), 12, "F1", SLIDE_W - 82 - SLIDE_MARGIN);
      const blockH = 17 * lines.length + 9;
      if (y - blockH < 70) {
        page = startSlidePage(pages, `${slide.heading} (cont.)`, spec.footer, index + 1, totalSlides);
        y = 452;
      }
      page.bullet(SLIDE_MARGIN, y, 11, NAVY);
      lines.forEach((line, i) => {
        page.text(SLIDE_MARGIN + 18, y - i * 17, line, 12, "F1", BODY);
      });
      y -= blockH + 17;
    }
  });

  return pages;
}

function startSlidePage(
  pages: PageBuilder[],
  heading: string,
  footer: string | undefined,
  slideNumber: number,
  totalSlides: number,
): PageBuilder {
  const page = new PageBuilder(SLIDE_W, SLIDE_H);
  pages.push(page);
  page.text(SLIDE_MARGIN, SLIDE_H - 92, heading, 21, "F2", INK);
  page.fillRect(SLIDE_MARGIN, SLIDE_H - 106, 76, 3, NAVY);
  if (footer) {
    page.text(SLIDE_MARGIN, 40, footer, 8.5, "F1", FAINT_GRAY);
  }
  page.textRight(SLIDE_W - SLIDE_MARGIN, 40, `${slideNumber} / ${totalSlides}`, 9, "F1", FAINT_GRAY);
  return page;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function createDocumentPdf(spec: PdfDocumentSpec): Uint8Array {
  const pages = spec.kind === "form" ? layoutForm(spec) : layoutSlides(spec);
  return assemblePdf(pages);
}
