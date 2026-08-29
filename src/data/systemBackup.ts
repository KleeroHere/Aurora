import { ulid } from "./ulid";
import { SCHEMA_VERSION } from "./types";
import type { AppLog } from "./types";
import {
  buildSystemDumpHeader,
  assertDumpDocCount,
  decodeDump,
  DEFAULT_MAX_DUMP_PART_BYTES,
  DumpSchemaVersionError,
  isDumpManifest,
} from "./dumpFormat";
import { assertDumpDatabase, collectBulkFailures, writeContentDumpStream } from "./dumpStream";
import type { ImportDocFailure, WrittenDump } from "./dumpStream";
import type { FilePort } from "./filePort";

export const SYSTEM_BACKUP_FILE_PREFIX = "aurora-system-backup-";

function fileTimestamp(now: Date): string {
  return now.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
}

export function defaultSystemBackupFileName(now: Date = new Date()): string {
  return `${SYSTEM_BACKUP_FILE_PREFIX}${fileTimestamp(now)}.json`;
}

export function looksLikeSystemBackupName(fileName: string): boolean {
  return fileName.startsWith(SYSTEM_BACKUP_FILE_PREFIX);
}

export async function writeSystemBackup(
  filePort: FilePort,
  systemDb: PouchDB.Database,
  baseName: string = defaultSystemBackupFileName(),
  maxPartBytes: number = DEFAULT_MAX_DUMP_PART_BYTES,
): Promise<WrittenDump> {
  return writeContentDumpStream(
    filePort,
    baseName,
    systemDb,
    (fileName) => filePort.getAutoBackupLocation(fileName),
    maxPartBytes,
    buildSystemDumpHeader(0),
  );
}

export interface SystemRestoreReport {
  merged: number;
  created: number;
  updated: number;
  failures: ImportDocFailure[];
  conflictsResolved: number;
}

export class SystemRestoreFailedError extends Error {
  constructor(public readonly report: SystemRestoreReport) {
    const shown = report.failures.slice(0, 5).map((f) => `${f.docId} (${f.reason})`);
    super(
      `The system database rejected ${report.failures.length} document(s) — the restore is incomplete. ` +
        `Not merged: ${shown.join(", ")}. Merged nevertheless: ${report.merged}.`,
    );
  }
}

function docTimestamp(doc: Record<string, unknown>): number {
  for (const field of ["updatedAt", "at", "seededAt", "createdAt"]) {
    const value = doc[field];
    if (typeof value === "string") {
      const parsed = new Date(value).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return 0;
}

async function resolveSystemConflicts(systemDb: PouchDB.Database, docIds: readonly string[]): Promise<number> {
  let resolved = 0;
  for (const docId of docIds) {
    const leafResults = await systemDb.get<Record<string, unknown>>(docId, { open_revs: "all" });
    const leaves = leafResults.map((r) => r.ok).filter((doc) => doc && !doc._deleted);
    if (leaves.length <= 1) continue;

    const winner = leaves.reduce((best, candidate) =>
      docTimestamp(candidate as unknown as Record<string, unknown>) >
      docTimestamp(best as unknown as Record<string, unknown>)
        ? candidate
        : best,
    );
    for (const loser of leaves) {
      if (loser._rev !== winner._rev) await systemDb.remove(loser._id, loser._rev);
    }
    const current = await systemDb.get(docId);
    if (current._rev !== winner._rev) {
      await systemDb.put({ ...winner, _rev: current._rev });
    }
    resolved += 1;
  }
  return resolved;
}

export async function restoreSystemDumpParts(
  systemDb: PouchDB.Database,
  parts: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
): Promise<SystemRestoreReport> {
  const failures: ImportDocFailure[] = [];
  const mergedIds: string[] = [];
  const existedBefore = new Set<string>();

  for await (const bytes of parts) {
    const part = decodeDump(bytes);
    if (part.header.schemaVersion !== SCHEMA_VERSION) {
      throw new DumpSchemaVersionError(SCHEMA_VERSION, part.header.schemaVersion);
    }
    assertDumpDatabase(part.header, "system");
    assertDumpDocCount(part);

    for (const doc of part.docs) {
      try {
        await systemDb.get(doc._id);
        existedBefore.add(doc._id);
      } catch (err) {
        if ((err as PouchDB.Core.Error).status !== 404) throw err;
      }
    }

    const results = await systemDb.bulkDocs(part.docs, { new_edits: false });
    const partFailures = collectBulkFailures(results, part.docs);
    failures.push(...partFailures);
    const failed = new Set(partFailures.map((f) => f.docId));
    for (const doc of part.docs) if (!failed.has(doc._id)) mergedIds.push(doc._id);
  }

  const conflictsResolved = await resolveSystemConflicts(
    systemDb,
    mergedIds.filter((id) => existedBefore.has(id)),
  );

  const created = mergedIds.filter((id) => !existedBefore.has(id)).length;
  const report: SystemRestoreReport = {
    merged: mergedIds.length,
    created,
    updated: mergedIds.length - created,
    failures,
    conflictsResolved,
  };

  await systemDb.put<Omit<AppLog, "_id">>({
    _id: `applog:${ulid()}`,
    type: "applog",
    schemaVersion: SCHEMA_VERSION,
    level: failures.length > 0 ? "warn" : "info",
    event: "system.restore",
    context: { ...report },
    at: new Date().toISOString(),
  } as AppLog);

  if (failures.length > 0) throw new SystemRestoreFailedError(report);
  return report;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export async function backupSystemDatabase(
  filePort: FilePort,
  systemDb: PouchDB.Database,
): Promise<WrittenDump> {
  const written = await writeSystemBackup(filePort, systemDb);
  await systemDb.put<Omit<AppLog, "_id">>({
    _id: `applog:${ulid()}`,
    type: "applog",
    schemaVersion: SCHEMA_VERSION,
    level: "info",
    event: "system.backup",
    context: { docCount: written.docCount, parts: written.partCount, files: written.fileNames },
    at: new Date().toISOString(),
  } as AppLog);
  return written;
}

export async function restoreSystemDatabaseFromFiles(
  filePort: FilePort,
  systemDb: PouchDB.Database,
): Promise<SystemRestoreReport | null> {
  const handles = await filePort.pickFiles();
  if (!handles || handles.length === 0) return null;

  async function* readOneAtATime(): AsyncGenerator<Uint8Array> {
    for (const handle of handles!) {
      const bytes = await filePort.readDump(handle);
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        throw new Error(
          `File "${filePort.fileName?.(handle) ?? "selected"}" is corrupted or is not JSON. Restore cancelled.`,
        );
      }
      if (isDumpManifest(parsed)) continue;
      yield bytes;
    }
  }

  return restoreSystemDumpParts(systemDb, readOneAtATime());
}
