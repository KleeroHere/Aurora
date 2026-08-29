import { SCHEMA_VERSION } from "./types";

export const BACKUP_STATE_ID = "settings:backup";

export const REMIND_AFTER_DAYS = 31;

export interface BackupState {
  _id: string;
  _rev?: string;
  type: "settings";
  schemaVersion: number;
  lastContentBackupAt: string | null;
  lastSystemBackupAt: string | null;
  updatedAt: string;
}

export function emptyBackupState(): BackupState {
  return {
    _id: BACKUP_STATE_ID,
    type: "settings",
    schemaVersion: SCHEMA_VERSION,
    lastContentBackupAt: null,
    lastSystemBackupAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadBackupState(systemDb: PouchDB.Database): Promise<BackupState> {
  try {
    const doc = await systemDb.get<BackupState>(BACKUP_STATE_ID);
    return { ...emptyBackupState(), ...doc };
  } catch (err) {
    if ((err as PouchDB.Core.Error).status === 404) return emptyBackupState();
    throw err;
  }
}

export type BackupKind = "content" | "system";

export async function markBackupDone(
  systemDb: PouchDB.Database,
  kind: BackupKind,
  at: string = new Date().toISOString(),
): Promise<BackupState> {
  const current = await loadBackupState(systemDb);
  const next: BackupState = {
    ...current,
    ...(kind === "content" ? { lastContentBackupAt: at } : { lastSystemBackupAt: at }),
    updatedAt: at,
  };
  const result = await systemDb.put(next as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);
  return { ...next, _rev: result.rev };
}

export interface ReminderVerdict {
  due: boolean;
  kinds: BackupKind[];
  daysSince: Record<BackupKind, number | null>;
}

function daysBetween(fromIso: string | null, now: Date): number | null {
  if (!fromIso) return null;
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return null;
  return Math.floor((now.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function checkReminder(state: BackupState, now: Date = new Date()): ReminderVerdict {
  const daysSince: Record<BackupKind, number | null> = {
    content: daysBetween(state.lastContentBackupAt, now),
    system: daysBetween(state.lastSystemBackupAt, now),
  };

  const kinds: BackupKind[] = [];
  for (const kind of ["content", "system"] as const) {
    const days = daysSince[kind];
    if (days === null || days >= REMIND_AFTER_DAYS) kinds.push(kind);
  }

  return { due: kinds.length > 0, kinds, daysSince };
}

const KIND_LABELS: Record<BackupKind, string> = {
  content: "materials",
  system: "accounts",
};

export function reminderText(verdict: ReminderVerdict): string | null {
  if (!verdict.due) return null;

  const parts = verdict.kinds.map((kind) => {
    const days = verdict.daysSince[kind];
    return days === null
      ? `the ${KIND_LABELS[kind]} backup has not been made yet`
      : `the ${KIND_LABELS[kind]} backup was made ${days} days ago`;
  });

  return `Time to save a backup: ${parts.join("; ")}. It takes a minute with the buttons below.`;
}

export function formatBackupMoment(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "not made yet";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "not made yet";
  const days = daysBetween(iso, now);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}
