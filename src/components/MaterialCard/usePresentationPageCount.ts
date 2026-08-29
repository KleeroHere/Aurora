import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { getMaterialPdfUrl } from "../../data/repository";

const pageCountCache = new Map<string, number>();

export interface PresentationPageCountResult {
  pageCount: number | null;
  elementRef: RefObject<HTMLElement | null>;
}

export function usePresentationPageCount(materialId: string, enabled: boolean): PresentationPageCountResult {
  const [pageCount, setPageCount] = useState<number | null>(pageCountCache.get(materialId) ?? null);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || pageCount !== null) return;
    const element = elementRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    let cancelled = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();

      (async () => {
        const cached = pageCountCache.get(materialId);
        if (cached !== undefined) {
          if (!cancelled) setPageCount(cached);
          return;
        }
        const url = await getMaterialPdfUrl(materialId);
        try {
          const { loadPdfDocument } = await import("../../data/pdf");
          const doc = await loadPdfDocument(url);
          try {
            pageCountCache.set(materialId, doc.numPages);
            if (!cancelled) setPageCount(doc.numPages);
          } finally {
            doc.destroy();
          }
        } finally {
          URL.revokeObjectURL(url);
        }
      })().catch(() => {
      });
    });

    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [materialId, enabled, pageCount]);

  return { pageCount, elementRef };
}
