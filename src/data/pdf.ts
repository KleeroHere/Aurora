export type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

let workerConfigured = false;

export type PdfDocumentHandle = PDFDocumentProxy & { destroy(): Promise<void> };

export async function loadPdfDocument(url: string): Promise<PdfDocumentHandle> {
  const pdfjsLib = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).href;
    workerConfigured = true;
  }
  const task = pdfjsLib.getDocument({ url });
  const document = await task.promise;
  return Object.assign(document, { destroy: () => task.destroy() });
}
