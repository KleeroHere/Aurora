import { loadPdfDocument } from "./pdf";

export const COVER_WIDTH_PX = 600;

export const MAX_PLAIN_TEXT_CHARS = 150_000;
export const MIN_MEANINGFUL_CHARS = 40;

export function normalizePdfText(raw: string): string {
  return raw
    .replace(/­/g, "")
    .replace(/-\s*\n\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PdfIntake {
  coverPng: Uint8Array | null;
  text: string;
  pageCount: number;
  truncated: boolean;
}

export async function readPdfIntake(pdfBytes: Uint8Array): Promise<PdfIntake> {
  const blob = new Blob([pdfBytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  let document_: Awaited<ReturnType<typeof loadPdfDocument>> | null = null;
  const empty: PdfIntake = { coverPng: null, text: "", pageCount: 0, truncated: false };

  try {
    document_ = await loadPdfDocument(url);
    const pageCount = document_.numPages;

    const first = await document_.getPage(1);
    const coverPng = await renderPageToPng(first);

    const pieces: string[] = [];
    let length = 0;
    let truncated = false;
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = pageNumber === 1 ? first : await document_.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = normalizePdfText(
        content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
      );
      if (!pageText) continue;
      if (length + pageText.length > MAX_PLAIN_TEXT_CHARS) {
        pieces.push(pageText.slice(0, Math.max(0, MAX_PLAIN_TEXT_CHARS - length)));
        truncated = true;
        break;
      }
      pieces.push(pageText);
      length += pageText.length + 1;
    }

    const text = pieces.join(" ").trim();
    return {
      coverPng,
      text: text.length >= MIN_MEANINGFUL_CHARS ? text : "",
      pageCount,
      truncated,
    };
  } catch {
    return empty;
  } finally {
    await document_?.destroy().catch(() => undefined);
    URL.revokeObjectURL(url);
  }
}

async function renderPageToPng(page: Awaited<ReturnType<Awaited<ReturnType<typeof loadPdfDocument>>["getPage"]>>) {
  try {
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: COVER_WIDTH_PX / base.width });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) return null;
    await page.render({ canvasContext: context, viewport, canvas }).promise;

    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) return null;
    return new Uint8Array(await png.arrayBuffer());
  } catch {
    return null;
  }
}
