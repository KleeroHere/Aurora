import {
  buildDumpHeader,
  buildManifest,
  DEFAULT_MAX_DUMP_PART_BYTES,
  dumpDatabaseKind,
  encodeDumpDoc,
  encodeDumpFromEncodedDocs,
  encodeManifest,
  manifestFileName,
  partFileName,
} from "./dumpFormat";
import type { DumpDatabaseKind, DumpDoc, DumpHeader, DumpManifestPart } from "./dumpFormat";
import type { FileHandle, FilePort } from "./filePort";

const DESIGN_DOC_PREFIX = "_design/";

export const DEFAULT_EXPORT_PAGE_SIZE = 8;

async function* iterateDocsForDump(db: PouchDB.Database, pageSize: number): AsyncGenerator<DumpDoc> {
  let startkey: string | undefined;
  for (;;) {
    const page =
      startkey === undefined
        ? await db.allDocs({ include_docs: true, attachments: true, binary: false, limit: pageSize })
        : await db.allDocs({
            include_docs: true,
            attachments: true,
            binary: false,
            limit: pageSize,
            startkey,
            skip: 1,
          });

    if (page.rows.length === 0) return;
    for (const row of page.rows) {
      const doc = row.doc;
      if (doc && !doc._id.startsWith(DESIGN_DOC_PREFIX)) yield doc as unknown as DumpDoc;
    }
    startkey = page.rows[page.rows.length - 1].key;
    if (page.rows.length < pageSize) return;
  }
}

export class WrongDumpDatabaseError extends Error {
  constructor(
    public readonly expected: DumpDatabaseKind,
    public readonly actual: DumpDatabaseKind,
  ) {
    const name = (kind: DumpDatabaseKind) =>
      kind === "system" ? "the system database (accounts, change log, shelf)" : "the materials database";
    super(
      `This is a dump of ${name(actual)}, but a dump of ${name(expected)} was expected. Import cancelled, the database is unchanged. ` +
        "Check the file name: a system database dump is named aurora-system-backup-…, " +
        "a materials dump is aurora-dump-… / aurora-backup-….",
    );
  }
}

export function assertDumpDatabase(header: Pick<DumpHeader, "database">, expected: DumpDatabaseKind): void {
  const actual = dumpDatabaseKind(header);
  if (actual !== expected) throw new WrongDumpDatabaseError(expected, actual);
}

export interface ImportDocFailure {
  docId: string;
  reason: string;
}

interface BulkDocsErrorRow {
  error?: boolean;
  id?: string;
  name?: string;
  message?: string;
  reason?: string;
}

export function collectBulkFailures(results: unknown, docs: readonly DumpDoc[]): ImportDocFailure[] {
  if (!Array.isArray(results)) return [];
  const failures: ImportDocFailure[] = [];
  results.forEach((row: BulkDocsErrorRow, index) => {
    if (!row || !row.error) return;
    failures.push({
      docId: row.id ?? docs[index]?._id ?? `#${index}`,
      reason: row.message ?? row.reason ?? row.name ?? "unknown error",
    });
  });
  return failures;
}

export interface DumpPart {
  header: DumpHeader;
  bytes: Uint8Array;
  docCount: number;
}

export async function* streamContentDumpParts(
  db: PouchDB.Database,
  maxPartBytes: number = DEFAULT_MAX_DUMP_PART_BYTES,
  pageSize: number = DEFAULT_EXPORT_PAGE_SIZE,
  baseHeader: DumpHeader = buildDumpHeader(0),
): AsyncGenerator<DumpPart> {
  let encodedDocs: Uint8Array[] = [];
  let groupBytes = 0;

  function flush(): DumpPart {
    const header: DumpHeader = { ...baseHeader, docCount: encodedDocs.length };
    const bytes = encodeDumpFromEncodedDocs(header, encodedDocs);
    const part: DumpPart = { header, bytes, docCount: encodedDocs.length };
    encodedDocs = [];
    groupBytes = 0;
    return part;
  }

  for await (const doc of iterateDocsForDump(db, pageSize)) {
    const encoded = encodeDumpDoc(doc);
    if (groupBytes > 0 && groupBytes + encoded.length > maxPartBytes) {
      yield flush();
    }
    encodedDocs.push(encoded);
    groupBytes += encoded.length;
  }
  yield flush();
}

export interface WrittenDump {
  fileNames: string[];
  partCount: number;
  docCount: number;
  byteSize: number;
}

export async function writeContentDumpStream(
  filePort: FilePort,
  baseName: string,
  db: PouchDB.Database,
  resolveLocation: (fileName: string) => Promise<FileHandle>,
  maxPartBytes: number = DEFAULT_MAX_DUMP_PART_BYTES,
  baseHeader: DumpHeader = buildDumpHeader(0),
): Promise<WrittenDump> {
  const iterator = streamContentDumpParts(
    db,
    maxPartBytes,
    DEFAULT_EXPORT_PAGE_SIZE,
    baseHeader,
  )[Symbol.asyncIterator]();

  let buffered: DumpPart | null = (await iterator.next()).value as DumpPart;
  const sharedHeader = buffered.header;
  let lookahead = await iterator.next();

  if (lookahead.done) {
    const location = await resolveLocation(baseName);
    await filePort.writeDump(location, buffered.bytes);
    const written: WrittenDump = {
      fileNames: [baseName],
      partCount: 1,
      docCount: buffered.docCount,
      byteSize: buffered.bytes.byteLength,
    };
    buffered = null;
    return written;
  }

  const fileNames: string[] = [];
  const manifestParts: DumpManifestPart[] = [];
  let byteSize = 0;
  let docCount = 0;

  async function writePart(part: DumpPart): Promise<void> {
    const fileName = partFileName(baseName, manifestParts.length);
    const location = await resolveLocation(fileName);
    await filePort.writeDump(location, part.bytes);
    fileNames.push(fileName);
    manifestParts.push({ file: fileName, docCount: part.docCount });
    byteSize += part.bytes.byteLength;
    docCount += part.docCount;
  }

  await writePart(buffered);
  buffered = null; // the first part's bytes are no longer retained
  while (!lookahead.done) {
    await writePart(lookahead.value as DumpPart);
    lookahead = await iterator.next(); // the previous part is released here
  }

  const manifestFile = manifestFileName(baseName);
  const manifestBytes = encodeManifest(buildManifest(sharedHeader, docCount, manifestParts));
  await filePort.writeDump(await resolveLocation(manifestFile), manifestBytes);
  fileNames.push(manifestFile);
  byteSize += manifestBytes.byteLength;

  return { fileNames, partCount: manifestParts.length, docCount, byteSize };
}
