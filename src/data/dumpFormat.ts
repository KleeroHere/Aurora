import { SCHEMA_VERSION } from "./types";

export const DUMP_FORMAT_VERSION = 1;

export type DumpDatabaseKind = "content" | "system";

export interface DumpHeader {
  dumpFormatVersion: number;
  schemaVersion: number;
  createdAt: string;
  docCount: number;
  database?: DumpDatabaseKind;
}

export function dumpDatabaseKind(header: Pick<DumpHeader, "database">): DumpDatabaseKind {
  return header.database === "system" ? "system" : "content";
}

export type DumpDoc = PouchDB.Core.ExistingDocument<Record<string, unknown>>;

export interface ContentDump {
  header: DumpHeader;
  docs: DumpDoc[];
}

export function buildDumpHeader(docCount: number, now: Date = new Date()): DumpHeader {
  return {
    dumpFormatVersion: DUMP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now.toISOString(),
    docCount,
  };
}

export function buildSystemDumpHeader(docCount: number, now: Date = new Date()): DumpHeader {
  return { ...buildDumpHeader(docCount, now), database: "system" };
}

export function encodeDump(dump: ContentDump): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(dump));
}

export function encodeDumpDoc(doc: DumpDoc): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(doc));
}

export function encodeDumpFromEncodedDocs(header: DumpHeader, encodedDocs: readonly Uint8Array[]): Uint8Array {
  const encoder = new TextEncoder();
  const prefix = encoder.encode(`{"header":${JSON.stringify(header)},"docs":[`);
  const suffix = encoder.encode("]}");
  const separators = encodedDocs.length > 1 ? encodedDocs.length - 1 : 0;

  let total = prefix.length + suffix.length + separators;
  for (const doc of encodedDocs) total += doc.length;

  const out = new Uint8Array(total);
  let at = 0;
  out.set(prefix, at);
  at += prefix.length;
  for (let i = 0; i < encodedDocs.length; i += 1) {
    if (i > 0) {
      out[at] = 0x2c; // comma between documents of the docs array
      at += 1;
    }
    out.set(encodedDocs[i], at);
    at += encodedDocs[i].length;
  }
  out.set(suffix, at);
  return out;
}

export const DEFAULT_MAX_DUMP_PART_BYTES = 50 * 1024 * 1024;

export function estimateDocBytes(doc: DumpDoc): number {
  return new TextEncoder().encode(JSON.stringify(doc)).length;
}

export function splitDocsIntoParts(
  docs: readonly DumpDoc[],
  maxPartBytes: number = DEFAULT_MAX_DUMP_PART_BYTES,
): DumpDoc[][] {
  if (docs.length === 0) return [[]];

  const groups: DumpDoc[][] = [[]];
  let currentBytes = 0;
  for (const doc of docs) {
    const docBytes = estimateDocBytes(doc);
    if (currentBytes > 0 && currentBytes + docBytes > maxPartBytes) {
      groups.push([]);
      currentBytes = 0;
    }
    groups[groups.length - 1].push(doc);
    currentBytes += docBytes;
  }
  return groups;
}

function splitExt(fileName: string): [stem: string, ext: string] {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? [fileName, ""] : [fileName.slice(0, dot), fileName.slice(dot)];
}

export function manifestFileName(baseName: string): string {
  const [stem, ext] = splitExt(baseName);
  return `${stem}.manifest${ext}`;
}

export function partFileName(baseName: string, index: number): string {
  const [stem, ext] = splitExt(baseName);
  return `${stem}.part${String(index + 1).padStart(3, "0")}${ext}`;
}

export function buildManifest(header: DumpHeader, totalDocCount: number, parts: DumpManifestPart[]): DumpManifest {
  return {
    dumpFormatVersion: header.dumpFormatVersion,
    schemaVersion: header.schemaVersion,
    createdAt: header.createdAt,
    totalDocCount,
    parts,
  };
}

export function encodeManifest(manifest: DumpManifest): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(manifest, null, 2));
}

export class DumpParseError extends Error {}

export class DumpSchemaVersionError extends Error {
  constructor(
    public readonly expected: number,
    public readonly actual: number,
  ) {
    super(
      `The dump was made for schemaVersion ${actual}, while the app runs schemaVersion ${expected}. ` +
        "Import cancelled - schema versions must match.",
    );
  }
}

export class DumpDocCountMismatchError extends Error {
  constructor(
    public readonly expected: number,
    public readonly actual: number,
  ) {
    super(
      `The dump file is incomplete: ${expected} documents declared, but ${actual} inside. ` +
        "Most likely the file did not finish copying - transfer it again and retry the import.",
    );
  }
}

export function assertDumpDocCount(dump: { header: DumpHeader; docs: unknown[] }): void {
  const expected = dump.header.docCount;
  if (typeof expected !== "number") return;
  if (expected !== dump.docs.length) {
    throw new DumpDocCountMismatchError(expected, dump.docs.length);
  }
}

export function decodeDump(bytes: Uint8Array): ContentDump {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new DumpParseError("The file is corrupted or is not a valid JSON dump.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("header" in parsed) ||
    !("docs" in parsed) ||
    typeof (parsed as { header?: unknown }).header !== "object" ||
    !Array.isArray((parsed as { docs?: unknown }).docs)
  ) {
    throw new DumpParseError("The file does not look like a database dump: header/docs fields are missing.");
  }

  const { header, docs } = parsed as { header: Partial<DumpHeader>; docs: DumpDoc[] };
  if (typeof header.schemaVersion !== "number" || typeof header.dumpFormatVersion !== "number") {
    throw new DumpParseError("The dump header is corrupted: schemaVersion/dumpFormatVersion missing.");
  }

  return { header: header as DumpHeader, docs };
}

export interface DumpManifestPart {
  file: string;
  docCount: number;
}

export interface DumpManifest {
  dumpFormatVersion: number;
  schemaVersion: number;
  createdAt: string;
  totalDocCount: number;
  parts: DumpManifestPart[];
}

export function isDumpManifest(parsed: unknown): parsed is DumpManifest {
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    Array.isArray((parsed as { parts?: unknown }).parts) &&
    typeof (parsed as { totalDocCount?: unknown }).totalDocCount === "number"
  );
}

export function decodeManifest(bytes: Uint8Array): DumpManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new DumpParseError("The manifest is corrupted or is not valid JSON.");
  }
  if (!isDumpManifest(parsed)) {
    throw new DumpParseError("The file does not look like a bundle manifest: parts/totalDocCount fields are missing.");
  }
  if (typeof parsed.schemaVersion !== "number" || typeof parsed.dumpFormatVersion !== "number") {
    throw new DumpParseError("The manifest is corrupted: schemaVersion/dumpFormatVersion missing.");
  }
  return parsed;
}

function fileTimestamp(now: Date): string {
  return now.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
}

export function defaultDumpFileName(now: Date = new Date()): string {
  return `aurora-dump-${fileTimestamp(now)}.json`;
}

export function defaultBackupFileName(now: Date = new Date()): string {
  return `aurora-backup-before-import-${fileTimestamp(now)}.json`;
}
