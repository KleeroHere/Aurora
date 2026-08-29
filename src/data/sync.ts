import { ulid } from "./ulid";
import { SCHEMA_VERSION } from "./types";
import type { AppLog } from "./types";
import { pickLatestByUpdatedAt } from "./conflictResolution";
import {
  buildManifest,
  decodeDump,
  decodeManifest,
  DEFAULT_MAX_DUMP_PART_BYTES,
  defaultBackupFileName,
  defaultDumpFileName,
  DumpParseError,
  DumpSchemaVersionError,
  assertDumpDocCount,
  encodeManifest,
  isDumpManifest,
  manifestFileName,
  partFileName,
} from "./dumpFormat";
import type { ContentDump, DumpHeader, DumpManifest } from "./dumpFormat";
import {
  assertDumpDatabase,
  collectBulkFailures,
  streamContentDumpParts,
  writeContentDumpStream,
} from "./dumpStream";
import type { ImportDocFailure, WrittenDump } from "./dumpStream";
import { writeSystemBackup } from "./systemBackup";
import type { FilePort } from "./filePort";

export {
  assertDumpDatabase,
  collectBulkFailures,
  DEFAULT_EXPORT_PAGE_SIZE,
  streamContentDumpParts,
  writeContentDumpStream,
  WrongDumpDatabaseError,
} from "./dumpStream";
export type { DumpPart, ImportDocFailure, WrittenDump } from "./dumpStream";

export interface EncodedDumpParts {
  header: DumpHeader;
  parts: Uint8Array[];
  docCounts: number[];
}

export async function exportContentDumpParts(
  contentDb: PouchDB.Database,
  maxPartBytes: number = DEFAULT_MAX_DUMP_PART_BYTES,
): Promise<EncodedDumpParts> {
  const parts: Uint8Array[] = [];
  const docCounts: number[] = [];
  let header: DumpHeader | null = null;

  for await (const part of streamContentDumpParts(contentDb, maxPartBytes)) {
    parts.push(part.bytes);
    docCounts.push(part.docCount);
    header ??= part.header;
  }

  const totalDocCount = docCounts.reduce((sum, count) => sum + count, 0);
  return { header: { ...(header as DumpHeader), docCount: totalDocCount }, parts, docCounts };
}

export async function exportContentDump(contentDb: PouchDB.Database): Promise<Uint8Array> {
  const { parts } = await exportContentDumpParts(contentDb);
  if (parts.length !== 1) {
    throw new Error(
      `The export split into ${parts.length} parts (the database is too big for one file) — ` +
        "use exportContentDumpParts.",
    );
  }
  return parts[0];
}

export interface StreamingBackupWriter {
  backupStreaming(contentDb: PouchDB.Database): Promise<void>;
}

export type BackupWriter = ((dump: EncodedDumpParts) => Promise<void>) | StreamingBackupWriter;

async function runBackup(writeBackup: BackupWriter, contentDb: PouchDB.Database): Promise<void> {
  if (typeof writeBackup === "function") {
    await writeBackup(await exportContentDumpParts(contentDb));
    return;
  }
  await writeBackup.backupStreaming(contentDb);
}

export interface ConflictResolution {
  docId: string;
  wonBy: "imported" | "local";
  discarded: number;
}

export interface ImportReport {
  merged: number;
  created: number;
  updated: number;
  conflictsResolved: number;
  resolutions: ConflictResolution[];
  failures: ImportDocFailure[];
}

interface WithUpdatedAt {
  updatedAt: string;
  [key: string]: unknown;
}

interface RawResolution {
  docId: string;
  discarded: number;
}

async function resolveConflictsForImportedDocs(
  contentDb: PouchDB.Database,
  importedIds: readonly string[],
): Promise<RawResolution[]> {
  const resolutions: RawResolution[] = [];

  for (const docId of importedIds) {
    const leafResults = await contentDb.get<WithUpdatedAt>(docId, { open_revs: "all" });
    const leaves = leafResults.map((r) => r.ok).filter((doc) => !doc._deleted);
    if (leaves.length <= 1) continue;

    const winner = pickLatestByUpdatedAt(leaves);
    const losers = leaves.filter((leaf) => leaf._rev !== winner._rev);
    for (const loser of losers) {
      await contentDb.remove(loser._id, loser._rev);
    }

    const currentAfterRemoval = await contentDb.get(docId);
    if (currentAfterRemoval._rev !== winner._rev) {
      await contentDb.put({ ...winner, _rev: currentAfterRemoval._rev });
    }

    resolutions.push({ docId, discarded: losers.length });
  }

  return resolutions;
}

export interface ImportProgress {
  phase: "reading" | "merging";
  fileIndex: number;
  totalFiles: number;
  docsMergedSoFar: number;
  totalDocsHint: number | null;
}

export async function importContentDumpParts(
  contentDb: PouchDB.Database,
  systemDb: PouchDB.Database,
  parts: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
  totalParts: number,
  writeBackup: BackupWriter,
  onProgress?: (progress: ImportProgress) => void,
  getTotalDocsHint: () => number | null = () => null,
): Promise<ImportReport> {
  let backedUp = false;
  let dumpCreatedAt: string | null = null;
  const allDocIds: string[] = [];
  const localBefore = new Map<string, { updatedAt?: string }>();
  let docsMergedSoFar = 0;
  let fileIndex = 0;
  const failures: ImportDocFailure[] = [];

  for await (const bytes of parts) {
    fileIndex += 1;
    const part: ContentDump = decodeDump(bytes);
    if (part.header.schemaVersion !== SCHEMA_VERSION) {
      throw new DumpSchemaVersionError(SCHEMA_VERSION, part.header.schemaVersion);
    }
    assertDumpDatabase(part.header, "content");
    assertDumpDocCount(part);

    if (!backedUp) {
      await runBackup(writeBackup, contentDb);
      backedUp = true;
    }
    dumpCreatedAt ??= part.header.createdAt;

    for (const doc of part.docs) {
      try {
        const local = await contentDb.get<WithUpdatedAt>(doc._id);
        localBefore.set(doc._id, { updatedAt: local.updatedAt });
      } catch (err) {
        if ((err as PouchDB.Core.Error).status !== 404) throw err;
      }
    }

    const bulkResults = await contentDb.bulkDocs(part.docs, { new_edits: false });
    const partFailures = collectBulkFailures(bulkResults, part.docs);
    failures.push(...partFailures);

    const failedIds = new Set(partFailures.map((f) => f.docId));
    for (const doc of part.docs) {
      if (!failedIds.has(doc._id)) allDocIds.push(doc._id);
    }
    docsMergedSoFar = allDocIds.length;

    onProgress?.({
      phase: "merging",
      fileIndex,
      totalFiles: totalParts,
      docsMergedSoFar,
      totalDocsHint: getTotalDocsHint(),
    });
  }

  const idsThatExistedBefore = allDocIds.filter((id) => localBefore.has(id));
  const rawResolutions = await resolveConflictsForImportedDocs(contentDb, idsThatExistedBefore);

  const resolutions: ConflictResolution[] = [];
  for (const r of rawResolutions) {
    const finalDoc = await contentDb.get<WithUpdatedAt>(r.docId);
    const wasLocalWinner = localBefore.get(r.docId)?.updatedAt === finalDoc.updatedAt;
    resolutions.push({ ...r, wonBy: wasLocalWinner ? "local" : "imported" });
  }

  const created = allDocIds.filter((id) => !localBefore.has(id)).length;
  const updated = allDocIds.length - created;

  const report: ImportReport = {
    merged: allDocIds.length,
    created,
    updated,
    conflictsResolved: resolutions.length,
    resolutions,
    failures,
  };

  await systemDb.put<Omit<AppLog, "_id">>({
    _id: `applog:${ulid()}`,
    type: "applog",
    schemaVersion: SCHEMA_VERSION,
    level: failures.length > 0 ? "warn" : "info",
    event: "sync.import",
    context: { ...report, dumpCreatedAt, partsCount: fileIndex },
    at: new Date().toISOString(),
  } as AppLog);

  if (failures.length > 0) {
    throw new ImportDocsRejectedError(report);
  }

  const expectedDocCount = getTotalDocsHint();
  if (expectedDocCount !== null && expectedDocCount !== report.merged) {
    throw new ImportDocCountMismatchError(expectedDocCount, report);
  }

  return report;
}

export class ImportDocsRejectedError extends Error {
  constructor(public readonly report: ImportReport) {
    const shown = report.failures.slice(0, 5).map((f) => `${f.docId} (${f.reason})`);
    const rest = report.failures.length - shown.length;
    super(
      `The database rejected ${report.failures.length} document(s) from the dump — the import is incomplete. ` +
        `Not merged: ${shown.join(", ")}${rest > 0 ? ` and ${rest} more` : ""}. ` +
        `Merged nevertheless: ${report.merged}. A backup of the pre-import state has already been saved ` +
        "to the backups/ folder next to the app.",
    );
  }
}

export class ImportDocCountMismatchError extends Error {
  constructor(
    public readonly expected: number,
    public readonly report: ImportReport,
  ) {
    const missing = expected - report.merged;
    super(
      `The import is incomplete: the bundle manifest promises ${expected} document(s), ${report.merged} merged` +
        (missing > 0
          ? ` — ${missing} missing. Most likely not all part files were selected.`
          : ` — that is more than promised; the file set does not match the manifest.`) +
        " A backup of the pre-import state has been saved to the backups/ folder next to the app.",
    );
  }
}

export async function importContentDump(
  contentDb: PouchDB.Database,
  systemDb: PouchDB.Database,
  dumpBytes: Uint8Array,
  writeBackup: BackupWriter,
): Promise<ImportReport> {
  return importContentDumpParts(contentDb, systemDb, [dumpBytes], 1, writeBackup);
}

export async function writeBackupParts(filePort: FilePort, baseName: string, dump: EncodedDumpParts): Promise<void> {
  if (dump.parts.length === 1) {
    const location = await filePort.getAutoBackupLocation(baseName);
    await filePort.writeDump(location, dump.parts[0]);
    return;
  }

  const totalDocCount = dump.docCounts.reduce((sum, count) => sum + count, 0);
  const manifest = buildManifest(
    dump.header,
    totalDocCount,
    dump.parts.map((_, index) => ({ file: partFileName(baseName, index), docCount: dump.docCounts[index] })),
  );
  const manifestLocation = await filePort.getAutoBackupLocation(manifestFileName(baseName));
  await filePort.writeDump(manifestLocation, encodeManifest(manifest));

  for (let index = 0; index < dump.parts.length; index += 1) {
    const partLocation = await filePort.getAutoBackupLocation(partFileName(baseName, index));
    await filePort.writeDump(partLocation, dump.parts[index]);
  }
}

export async function writeBackupStream(
  filePort: FilePort,
  baseName: string,
  contentDb: PouchDB.Database,
  maxPartBytes: number = DEFAULT_MAX_DUMP_PART_BYTES,
): Promise<WrittenDump> {
  return writeContentDumpStream(
    filePort,
    baseName,
    contentDb,
    (fileName) => filePort.getAutoBackupLocation(fileName),
    maxPartBytes,
  );
}

async function logExport(systemDb: PouchDB.Database, docCount: number): Promise<void> {
  await systemDb.put<Omit<AppLog, "_id">>({
    _id: `applog:${ulid()}`,
    type: "applog",
    schemaVersion: SCHEMA_VERSION,
    level: "info",
    event: "sync.export",
    context: { docCount },
    at: new Date().toISOString(),
  } as AppLog);
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export interface ExportResult {
  docCount: number;
  byteSize: number;
}

const EXPORT_DIALOG_TITLE = "Where to save the database export file";

export class ExportTooLargeForSingleFileError extends Error {
  constructor(public readonly parts: number) {
    super(
      `The database does not fit into a single export file (it would split into ${parts} parts) — ` +
        "this export path only supports a single-file dump. " +
        'Use exportDatabaseToFiles (the "Export database" button goes exactly there).',
    );
  }
}

export class ExportSiblingLocationUnsupportedError extends Error {
  constructor() {
    super(
      "The database does not fit into one file, and the chosen location does not support writing " +
        "several files side by side. Export to a regular folder on disk or to removable media.",
    );
  }
}

export async function exportDatabaseToFile(
  filePort: FilePort,
  contentDb: PouchDB.Database,
  systemDb: PouchDB.Database,
  maxPartBytes: number = DEFAULT_MAX_DUMP_PART_BYTES,
): Promise<ExportResult | null> {
  const dump = await exportContentDumpParts(contentDb, maxPartBytes);
  if (dump.parts.length !== 1) {
    throw new ExportTooLargeForSingleFileError(dump.parts.length);
  }
  const bytes = dump.parts[0];

  const location = await filePort.pickSaveLocation(defaultDumpFileName(), EXPORT_DIALOG_TITLE);
  if (!location) return null;

  await filePort.writeDump(location, bytes);

  const docCount = dump.docCounts[0];
  await logExport(systemDb, docCount);
  return { docCount, byteSize: bytes.byteLength };
}

export interface ExportFilesResult extends ExportResult {
  partCount: number;
  fileNames: string[];
}

export async function exportDatabaseToFiles(
  filePort: FilePort,
  contentDb: PouchDB.Database,
  systemDb: PouchDB.Database,
  maxPartBytes: number = DEFAULT_MAX_DUMP_PART_BYTES,
): Promise<ExportFilesResult | null> {
  const baseName = defaultDumpFileName();
  const chosen = await filePort.pickSaveLocation(baseName, EXPORT_DIALOG_TITLE);
  if (!chosen) return null;

  const written = await writeContentDumpStream(
    filePort,
    baseName,
    contentDb,
    async (fileName) => {
      if (fileName === baseName) return chosen;
      if (!filePort.siblingLocation) throw new ExportSiblingLocationUnsupportedError();
      return filePort.siblingLocation(chosen, fileName);
    },
    maxPartBytes,
  );

  await logExport(systemDb, written.docCount);
  return {
    docCount: written.docCount,
    byteSize: written.byteSize,
    partCount: written.partCount,
    fileNames: written.fileNames,
  };
}

export async function importDatabaseFromFile(
  filePort: FilePort,
  contentDb: PouchDB.Database,
  systemDb: PouchDB.Database,
): Promise<ImportReport | null> {
  const fileHandle = await filePort.pickFile();
  if (!fileHandle) return null;

  const dumpBytes = await filePort.readDump(fileHandle);

  const backupBaseName = defaultBackupFileName();

  return importContentDump(contentDb, systemDb, dumpBytes, {
    backupStreaming: async (db) => {
      await writeBackupStream(filePort, backupBaseName, db);
      await writeSystemBackup(filePort, systemDb);
    },
  });
}

export class ImportManifestPartsMissingError extends Error {
  constructor() {
    super(
      "Only the bundle manifest was selected, without the parts themselves. Open the file picker again " +
        "and select the manifest TOGETHER with all the part files (for example, Ctrl+A in the bundle folder).",
    );
  }
}

export class ImportBundleSelectionError extends Error {
  constructor(
    public readonly missing: readonly string[],
    public readonly unexpected: readonly string[],
    public readonly manifestPartCount: number,
    public readonly selectedPartCount: number,
  ) {
    const lines: string[] = [
      `An incomplete or foreign set of bundle files was selected: the manifest lists ${manifestPartCount} ` +
        `part(s), ${selectedPartCount} selected.`,
    ];
    if (missing.length > 0) {
      lines.push(`Missing files (${missing.length}): ${missing.join(", ")}.`);
    }
    if (unexpected.length > 0) {
      lines.push(`Extra files not in the manifest (${unexpected.length}): ${unexpected.join(", ")}.`);
    }
    lines.push("The import is cancelled, the database unchanged. Select the manifest and ALL parts of one bundle together (Ctrl+A).");
    super(lines.join(" "));
  }
}

export class ImportMultipleManifestsError extends Error {
  constructor(public readonly manifestFiles: readonly string[]) {
    super(
      `Several manifests were selected (${manifestFiles.join(", ")}) — these are files of different bundles. ` +
        "Import bundles one at a time: a manifest and its parts.",
    );
  }
}

export class ImportPartParseError extends DumpParseError {
  constructor(public readonly fileName: string) {
    super(`File "${fileName}" is corrupted or is not JSON. Import cancelled.`);
  }
}

function isManifestFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".manifest.json");
}

export function verifyBundleSelection(manifest: DumpManifest, selectedPartFileNames: readonly string[]): void {
  const expected = manifest.parts.map((part) => part.file);
  const selected = new Set(selectedPartFileNames);
  const expectedSet = new Set(expected);

  const missing = expected.filter((file) => !selected.has(file));
  const unexpected = selectedPartFileNames.filter((file) => !expectedSet.has(file));

  if (missing.length > 0 || unexpected.length > 0) {
    throw new ImportBundleSelectionError(missing, unexpected, expected.length, selectedPartFileNames.length);
  }
}

export async function importDatabaseFromFiles(
  filePort: FilePort,
  contentDb: PouchDB.Database,
  systemDb: PouchDB.Database,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportReport | null> {
  const handles = await filePort.pickFiles();
  if (!handles || handles.length === 0) return null;

  const fileNames = handles.map((handle) => filePort.fileName?.(handle) ?? null);
  const describeFile = (index: number): string => fileNames[index] ?? `file #${index + 1} of the selection`;

  const manifestIndexes = fileNames.flatMap((name, index) => (name && isManifestFileName(name) ? [index] : []));
  if (manifestIndexes.length > 1) {
    throw new ImportMultipleManifestsError(manifestIndexes.map((index) => describeFile(index)));
  }

  let totalDocsHint: number | null = null;
  let partIndexes = handles.map((_, index) => index);

  if (manifestIndexes.length === 1) {
    const manifestIndex = manifestIndexes[0];
    let manifest: DumpManifest;
    try {
      manifest = decodeManifest(await filePort.readDump(handles[manifestIndex]));
    } catch (err) {
      if (err instanceof DumpParseError) throw new ImportPartParseError(describeFile(manifestIndex));
      throw err;
    }
    totalDocsHint = manifest.totalDocCount;
    partIndexes = partIndexes.filter((index) => index !== manifestIndex);

    if (partIndexes.length === 0) throw new ImportManifestPartsMissingError();

    const selectedPartNames = partIndexes.map((index) => fileNames[index]).filter((name): name is string => name !== null);
    if (selectedPartNames.length === partIndexes.length) {
      verifyBundleSelection(manifest, selectedPartNames);
    }
  }

  const backupBaseName = defaultBackupFileName();
  let sawAnyPart = false;

  async function* readPartsOneAtATime(): AsyncGenerator<Uint8Array> {
    for (let position = 0; position < partIndexes.length; position += 1) {
      const index = partIndexes[position];
      const bytes = await filePort.readDump(handles![index]);
      onProgress?.({
        phase: "reading",
        fileIndex: position + 1,
        totalFiles: partIndexes.length,
        docsMergedSoFar: 0,
        totalDocsHint,
      });

      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        throw new ImportPartParseError(describeFile(index));
      }
      if (isDumpManifest(parsed)) {
        totalDocsHint ??= decodeManifest(bytes).totalDocCount;
        continue;
      }
      sawAnyPart = true;
      yield bytes;
    }
  }

  const report = await importContentDumpParts(
    contentDb,
    systemDb,
    readPartsOneAtATime(),
    partIndexes.length,
    {
      backupStreaming: async (db) => {
        await writeBackupStream(filePort, backupBaseName, db);
        await writeSystemBackup(filePort, systemDb);
      },
    },
    onProgress,
    () => (sawAnyPart ? totalDocsHint : null),
  );

  if (!sawAnyPart) {
    throw new ImportManifestPartsMissingError();
  }
  return report;
}
