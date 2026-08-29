
export type SyncStatus = "idle" | "writing" | "exchanging" | "error";

export interface SyncStatusState {
  status: SyncStatus;
  errorMessage: string | null;
}

const WRITING_HOLD_MS = 1500;

let current: SyncStatusState = { status: "idle", errorMessage: null };
let holdTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(state: SyncStatusState) => void>();

function emit(): void {
  for (const fn of listeners) fn(current);
}

export function getSyncStatus(): SyncStatusState {
  return current;
}

export function onSyncStatusChange(handler: (state: SyncStatusState) => void): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function pulseWriting(): void {
  if (current.status === "error") return; // the error is sticky until cleared explicitly
  current = { status: "writing", errorMessage: null };
  emit();
  if (holdTimer) clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {
    current = { status: "idle", errorMessage: null };
    emit();
  }, WRITING_HOLD_MS);
}

export function pulseExchanging(active: boolean): void {
  if (current.status === "error") return;
  if (holdTimer) clearTimeout(holdTimer);
  current = active ? { status: "exchanging", errorMessage: null } : { status: "idle", errorMessage: null };
  emit();
}

export function pulseError(message: string): void {
  if (holdTimer) clearTimeout(holdTimer);
  current = { status: "error", errorMessage: message };
  emit();
}

export function clearSyncError(): void {
  if (current.status !== "error") return;
  current = { status: "idle", errorMessage: null };
  emit();
}
