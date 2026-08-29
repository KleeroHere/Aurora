import { useEffect } from "react";

export const APP_TITLE = "Aurora";

export function buildDocumentTitle(subject: string | null | undefined): string {
  const trimmed = subject?.trim();
  return trimmed ? `${trimmed} — ${APP_TITLE}` : APP_TITLE;
}

export function useDocumentTitle(subject: string | null | undefined): void {
  useEffect(() => {
    const previous = document.title;
    document.title = buildDocumentTitle(subject);
    return () => {
      document.title = previous;
    };
  }, [subject]);
}
