import { useEffect, useRef, useState } from "react";
import type { EditorJsOutputData } from "../data/types";

const AUTOSAVE_INTERVAL_MS = 12000;

export interface AutosaveDraft {
  body: EditorJsOutputData;
  savedAt: string;
}

function draftKey(materialId: string): string {
  return `aurora.autosave.${materialId}`;
}

export function readAutosaveDraft(materialId: string): AutosaveDraft | null {
  const raw = window.localStorage.getItem(draftKey(materialId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AutosaveDraft;
    if (!parsed || typeof parsed.savedAt !== "string" || !parsed.body) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAutosaveDraft(materialId: string): void {
  window.localStorage.removeItem(draftKey(materialId));
}

export type AutosaveStatus = { kind: "idle" } | { kind: "saved"; at: Date };

export function useAutosave(
  materialId: string,
  enabled: boolean,
  getSnapshot: () => Promise<EditorJsOutputData | null>,
): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>({ kind: "idle" });
  const getSnapshotRef = useRef(getSnapshot);
  getSnapshotRef.current = getSnapshot;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const interval = window.setInterval(async () => {
      const snapshot = await getSnapshotRef.current();
      if (cancelled || !snapshot) return;
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(draftKey(materialId), JSON.stringify({ body: snapshot, savedAt }));
      setStatus({ kind: "saved", at: new Date(savedAt) });
    }, AUTOSAVE_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [materialId, enabled]);

  return status;
}
