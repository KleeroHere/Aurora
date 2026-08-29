
export interface PdfPrintRequest {
  kind?: "pdf";
  pdfUrl: string;
  title: string;
  ownsUrl?: boolean;
}

export interface HtmlPrintRequest {
  kind: "html";
  html: string;
  title: string;
  landscape?: boolean;
}

export type PrintRequest = PdfPrintRequest | HtmlPrintRequest;

export function isHtmlPrintRequest(request: PrintRequest): request is HtmlPrintRequest {
  return request.kind === "html";
}

const EVENT_NAME = "aurora:print-request";

export function requestPrintPreview(request: PrintRequest): void {
  window.dispatchEvent(new CustomEvent<PrintRequest>(EVENT_NAME, { detail: request }));
}

export function onPrintPreviewRequest(handler: (request: PrintRequest) => void): () => void {
  function listener(event: Event): void {
    handler((event as CustomEvent<PrintRequest>).detail);
  }
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
