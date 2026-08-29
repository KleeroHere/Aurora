import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import { createContentDb, createSystemDb } from "./db";
import { DumpSchemaVersionError, buildDumpHeader, decodeDump, decodeManifest, encodeDump } from "./dumpFormat";
import type { ContentDump, DumpDoc, DumpManifest } from "./dumpFormat";
import {
  ExportTooLargeForSingleFileError,
  ImportManifestPartsMissingError,
  exportContentDump,
  exportContentDumpParts,
  exportDatabaseToFile,
  importContentDump,
  importContentDumpParts,
  importDatabaseFromFile,
  importDatabaseFromFiles,
  writeBackupParts,
} from "./sync";
import type { EncodedDumpParts, ImportProgress } from "./sync";
import type { FilePort, FileHandle } from "./filePort";
import { uint8ArrayToBase64 } from "./binary";

let contentDb: PouchDB.Database;
let systemDb: PouchDB.Database;

beforeEach(() => {
  contentDb = createContentDb(NodePouchDB, createNodeDbOptions());
  systemDb = createSystemDb(NodePouchDB, createNodeDbOptions());
});

afterEach(async () => {
  await contentDb.destroy().catch(() => undefined);
  await systemDb.destroy().catch(() => undefined);
});

function makeSectionDoc(id: string, title: string) {
  return {
    _id: id,
    type: "section",
    schemaVersion: 1,
    title,
    slug: id.split(":")[1],
    description: "",
    macroCategory: "methods",
    parentId: null,
    layout: "list",
    order: 1,
    cover: null,
    primaryTag: "test",
    legacy: { sourcePaths: [] },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

let syntheticRevCounter = 0;

function nextSyntheticRev(): string {
  syntheticRevCounter += 1;
  return `1-${syntheticRevCounter.toString(16).padStart(32, "0")}`;
}

function makeArticleDoc(id: string, title: string, sectionId: string, updatedAt: string) {
  return {
    _id: id,
    type: "article",
    schemaVersion: 1,
    title,
    sectionId,
    tags: [],
    card: { color: "neutral", cover: null },
    order: 1,
    createdBy: "migration",
    createdAt: updatedAt,
    updatedBy: "migration",
    updatedAt,
    legacy: null,
    body: { time: 1, blocks: [{ type: "paragraph", data: { text: title } }], version: "2.31.6" },
    plainText: title,
    excerpt: title,
    readingTime: 1,
  };
}

function makeDumpArticleDoc(id: string, title: string, sectionId: string, updatedAt: string): DumpDoc {
  return {
    ...makeArticleDoc(id, title, sectionId, updatedAt),
    _rev: nextSyntheticRev(),
  } as unknown as DumpDoc;
}

const noopBackup = async () => undefined;

describe("exportContentDump", () => {
  it("exports content-database documents together with attachments (base64)", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    await contentDb.put(makeArticleDoc("article:test__a", "A", "section:test", "2026-01-01T00:00:00.000Z"));
    const png = uint8ArrayToBase64(new Uint8Array([1, 2, 3, 4]));
    const doc = await contentDb.get("article:test__a");
    await contentDb.putAttachment("article:test__a", "img-1", doc._rev, png, "image/png");

    const bytes = await exportContentDump(contentDb);
    const dump = decodeDump(bytes);

    expect(dump.header.docCount).toBe(2);
    const article = dump.docs.find((d) => d._id === "article:test__a") as DumpDoc & {
      _attachments: Record<string, { data: string }>;
    };
    expect(article._attachments["img-1"].data).toBe(png);
  });

  it("does not include service _design documents", async () => {
    await contentDb.createIndex({ index: { fields: ["sectionId"], name: "idx", ddoc: "idx" } });
    await contentDb.put(makeSectionDoc("section:test", "Test"));

    const bytes = await exportContentDump(contentDb);
    const dump = decodeDump(bytes);

    expect(dump.docs.some((d) => d._id.startsWith("_design/"))).toBe(false);
  });

  it("never sees and cannot export the system database (separate DB objects)", async () => {
    await systemDb.put({
      _id: "user:01ARZ3NDEKTSV4RRFFQ69G5FAV",
      type: "user",
      schemaVersion: 1,
      login: "admin",
      displayName: "Admin",
      passwordHash: "x",
      role: "consultant",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastLoginAt: null,
    });
    await contentDb.put(makeSectionDoc("section:test", "Test"));

    const bytes = await exportContentDump(contentDb);
    const dump = decodeDump(bytes);

    expect(dump.docs.every((d) => (d as unknown as { type: string }).type !== "user")).toBe(true);
    expect(dump.docs.length).toBe(1);
  });
});

describe("importContentDump: carrying state over", () => {
  it("export from a filled database -> import into an empty one reproduces the state fully, attachments included", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    await contentDb.put(makeArticleDoc("article:test__a", "A", "section:test", "2026-01-01T00:00:00.000Z"));
    const png = uint8ArrayToBase64(new Uint8Array([9, 9, 9]));
    const doc = await contentDb.get("article:test__a");
    await contentDb.putAttachment("article:test__a", "img-1", doc._rev, png, "image/png");

    const bytes = await exportContentDump(contentDb);

    const freshContentDb = new NodePouchDB("content-fresh-machine", createNodeDbOptions());
    try {
      const report = await importContentDump(freshContentDb, systemDb, bytes, noopBackup);
      expect(report.merged).toBe(2);
      expect(report.created).toBe(2);
      expect(report.updated).toBe(0);
      expect(report.conflictsResolved).toBe(0);

      const restoredArticle = await freshContentDb.get("article:test__a");
      expect((restoredArticle as unknown as { title: string }).title).toBe("A");
      const attachment = await freshContentDb.getAttachment("article:test__a", "img-1");
      expect(attachment).toBeTruthy();
    } finally {
      await freshContentDb.destroy().catch(() => undefined);
    }
  });
});

describe("importContentDump: LWW conflict resolution", () => {
  const REV_A = "1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const REV_B = "1-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

  it("newer wins: a later updatedAt from the DUMP beats an earlier LOCAL version", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    await contentDb.bulkDocs(
      [{ ...makeArticleDoc("article:test__x", "Local (old)", "section:test", "2026-01-01T00:00:00.000Z"), _rev: REV_A }],
      { new_edits: false },
    );

    const importedDoc = { ...makeArticleDoc("article:test__x", "Imported (new)", "section:test", "2026-06-01T00:00:00.000Z"), _rev: REV_B };
    const dump: ContentDump = { header: buildDumpHeader(1), docs: [importedDoc as unknown as DumpDoc] };

    const report = await importContentDump(contentDb, systemDb, encodeDump(dump), noopBackup);

    expect(report.conflictsResolved).toBe(1);
    expect(report.resolutions[0]).toMatchObject({ docId: "article:test__x", wonBy: "imported", discarded: 1 });

    const final = await contentDb.get("article:test__x");
    expect((final as unknown as { title: string }).title).toBe("Imported (new)");

    const withConflicts = await contentDb.get("article:test__x", { conflicts: true });
    expect((withConflicts as unknown as { _conflicts?: string[] })._conflicts ?? []).toEqual([]);
  });

  it("newer wins: a later LOCAL version beats an earlier version from the dump", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    await contentDb.bulkDocs(
      [{ ...makeArticleDoc("article:test__x", "Local (new)", "section:test", "2026-06-01T00:00:00.000Z"), _rev: REV_A }],
      { new_edits: false },
    );

    const importedDoc = { ...makeArticleDoc("article:test__x", "Imported (old)", "section:test", "2026-01-01T00:00:00.000Z"), _rev: REV_B };
    const dump: ContentDump = { header: buildDumpHeader(1), docs: [importedDoc as unknown as DumpDoc] };

    const report = await importContentDump(contentDb, systemDb, encodeDump(dump), noopBackup);

    expect(report.resolutions[0]).toMatchObject({ docId: "article:test__x", wonBy: "local", discarded: 1 });
    const final = await contentDb.get("article:test__x");
    expect((final as unknown as { title: string }).title).toBe("Local (new)");
  });

  it("documents without a local rival (new ids) produce no conflicts", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const dump: ContentDump = {
      header: buildDumpHeader(1),
      docs: [makeDumpArticleDoc("article:test__new", "New", "section:test", "2026-01-01T00:00:00.000Z")],
    };
    const report = await importContentDump(contentDb, systemDb, encodeDump(dump), noopBackup);
    expect(report.conflictsResolved).toBe(0);
    expect(report.created).toBe(1);
  });
});

describe("importContentDump: the mandatory auto-backup", () => {
  it("if the backup fails, the import does not start and the database is unchanged", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const dump: ContentDump = {
      header: buildDumpHeader(1),
      docs: [makeDumpArticleDoc("article:test__new", "New", "section:test", "2026-01-01T00:00:00.000Z")],
    };

    const failingBackup = vi.fn().mockRejectedValue(new Error("no space left on device"));
    await expect(importContentDump(contentDb, systemDb, encodeDump(dump), failingBackup)).rejects.toThrow(
      "no space left on device",
    );

    expect(failingBackup).toHaveBeenCalledTimes(1);
    await expect(contentDb.get("article:test__new")).rejects.toMatchObject({ status: 404 });
  });

  it("the backup is called BEFORE merging and receives a full dump of the current database", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    await contentDb.put(makeArticleDoc("article:test__existing", "Already here", "section:test", "2026-01-01T00:00:00.000Z"));

    let backupDump: ContentDump | null = null;
    const captureBackup = async (dump: EncodedDumpParts) => {
      expect(dump.parts).toHaveLength(1);
      backupDump = decodeDump(dump.parts[0]);
    };

    const dump: ContentDump = {
      header: buildDumpHeader(1),
      docs: [makeDumpArticleDoc("article:test__new", "New", "section:test", "2026-01-01T00:00:00.000Z")],
    };
    await importContentDump(contentDb, systemDb, encodeDump(dump), captureBackup);

    expect(backupDump).not.toBeNull();
    expect(backupDump!.docs.some((d) => d._id === "article:test__new")).toBe(false);
    expect(backupDump!.docs.some((d) => d._id === "article:test__existing")).toBe(true);
  });
});

describe("importContentDump: schemaVersion mismatch", () => {
  it("a dump with a foreign schemaVersion is rejected, the import does not run", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const dump: ContentDump = {
      header: { ...buildDumpHeader(0), schemaVersion: 999 },
      docs: [],
    };
    const backup = vi.fn();

    await expect(importContentDump(contentDb, systemDb, encodeDump(dump), backup)).rejects.toThrow(
      DumpSchemaVersionError,
    );
    expect(backup).not.toHaveBeenCalled();
  });
});

describe("importContentDump: logging goes to applog, not change", () => {
  it("the import writes an entry to the system database applog, not to change", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const dump: ContentDump = {
      header: buildDumpHeader(1),
      docs: [makeDumpArticleDoc("article:test__new", "New", "section:test", "2026-01-01T00:00:00.000Z")],
    };
    await importContentDump(contentDb, systemDb, encodeDump(dump), noopBackup);

    const applogRows = await systemDb.allDocs({ startkey: "applog:", endkey: "applog:￿", include_docs: true });
    expect(applogRows.rows.length).toBe(1);
    expect((applogRows.rows[0].doc as unknown as { event: string }).event).toBe("sync.import");

    const changeRows = await systemDb.allDocs({ startkey: "change:", endkey: "change:￿" });
    expect(changeRows.rows.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

function createFakeFilePort(
  filesToPick: FileHandle[] = [],
  filesToPickMulti: FileHandle[][] = [],
): FilePort & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  let pickIndex = 0;
  let pickMultiIndex = 0;
  return {
    files,
    async writeDump(location, data) {
      files.set(location as string, data);
    },
    async readDump(handle) {
      const bytes = files.get(handle as string);
      if (!bytes) throw new Error("file not found in the stub");
      return bytes;
    },
    async pickFile() {
      const next = filesToPick[pickIndex];
      pickIndex += 1;
      return next ?? null;
    },
    async pickFiles() {
      const next = filesToPickMulti[pickMultiIndex];
      pickMultiIndex += 1;
      return next ?? null;
    },
    async pickSaveLocation(suggestedName) {
      return suggestedName;
    },
    async getAutoBackupLocation(suggestedName) {
      return `backups/${suggestedName}`;
    },
  };
}

describe("exportDatabaseToFile / importDatabaseFromFile: orchestration through FilePort", () => {
  it("the export writes the dump via filePort.writeDump under the suggested name and logs the event", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const filePort = createFakeFilePort();

    const result = await exportDatabaseToFile(filePort, contentDb, systemDb);

    expect(result).not.toBeNull();
    expect(result!.docCount).toBe(1);
    expect(filePort.files.size).toBe(1);

    const applogRows = await systemDb.allDocs({ startkey: "applog:", endkey: "applog:￿", include_docs: true });
    expect((applogRows.rows[0].doc as unknown as { event: string }).event).toBe("sync.export");
  });

  it("an export cancelled by the user (pickSaveLocation -> null) writes nothing and logs nothing", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const filePort = createFakeFilePort();
    filePort.pickSaveLocation = async () => null;

    const result = await exportDatabaseToFile(filePort, contentDb, systemDb);

    expect(result).toBeNull();
    expect(filePort.files.size).toBe(0);
    const applogRows = await systemDb.allDocs({ startkey: "applog:", endkey: "applog:￿" });
    expect(applogRows.rows.length).toBe(0);
  });

  it("the import reads the file via filePort.readDump and creates the auto-backup as a separate file next to it", async () => {
    const sourceDb = new NodePouchDB("content-source-machine", createNodeDbOptions());
    await sourceDb.put(makeSectionDoc("section:test", "Test"));
    await sourceDb.put(makeArticleDoc("article:test__a", "A", "section:test", "2026-01-01T00:00:00.000Z"));
    const dumpBytes = await exportContentDump(sourceDb);
    await sourceDb.destroy().catch(() => undefined);

    await contentDb.put(makeSectionDoc("section:test", "Test")); // the target database already holds something
    const filePort = createFakeFilePort(["imported-dump.json"]);
    filePort.files.set("imported-dump.json", dumpBytes);

    const report = await importDatabaseFromFile(filePort, contentDb, systemDb);

    expect(report).not.toBeNull();
    expect(report!.created).toBe(1);
    expect(filePort.files.size).toBe(3);
    expect([...filePort.files.keys()].some((k) => k.startsWith("backups/aurora-backup-before-import-"))).toBe(true);
    expect([...filePort.files.keys()].some((k) => k.startsWith("backups/aurora-system-backup-"))).toBe(true);

    const restored = await contentDb.get("article:test__a");
    expect((restored as unknown as { title: string }).title).toBe("A");
  });

  it("an import cancelled at file selection (pickFile -> null) leaves the database alone", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const filePort = createFakeFilePort([]); // pickFile always returns null

    const report = await importDatabaseFromFile(filePort, contentDb, systemDb);

    expect(report).toBeNull();
  });

  it("the auto-backup goes through getAutoBackupLocation (quietly); pickSaveLocation is never called during import (2026-08-01)", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const dump: ContentDump = {
      header: buildDumpHeader(0),
      docs: [],
    };
    const filePort = createFakeFilePort(["imported-dump.json"]);
    filePort.files.set("imported-dump.json", encodeDump(dump));

    let pickSaveLocationCalls = 0;
    filePort.pickSaveLocation = async (suggestedName) => {
      pickSaveLocationCalls += 1;
      return suggestedName;
    };
    let backupCalls = 0;
    filePort.getAutoBackupLocation = async (suggestedName) => {
      backupCalls += 1;
      return `backups/${suggestedName}`;
    };

    await importDatabaseFromFile(filePort, contentDb, systemDb);

    expect(backupCalls).toBe(2);
    expect(pickSaveLocationCalls).toBe(0);
    expect([...filePort.files.keys()].some((k) => k.startsWith("backups/aurora-backup-before-import-"))).toBe(true);
    expect([...filePort.files.keys()].some((k) => k.startsWith("backups/aurora-system-backup-"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

describe("exportContentDumpParts: splitting into parts on export/auto-backup", () => {
  it("a small database — one part, same as exportContentDump before", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const dump = await exportContentDumpParts(contentDb);
    expect(dump.parts).toHaveLength(1);
    expect(dump.docCounts).toEqual([1]);
  });

  it("with a small maxPartBytes it splits into several parts, not a single document is lost", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    await contentDb.put(makeArticleDoc("article:test__a", "A", "section:test", "2026-01-01T00:00:00.000Z"));
    await contentDb.put(makeArticleDoc("article:test__b", "B", "section:test", "2026-01-01T00:00:00.000Z"));
    await contentDb.put(makeArticleDoc("article:test__c", "C", "section:test", "2026-01-01T00:00:00.000Z"));

    const dump = await exportContentDumpParts(contentDb, 200); // deliberately smaller than the sum of all documents

    expect(dump.parts.length).toBeGreaterThan(1);
    expect(dump.docCounts.reduce((a, b) => a + b, 0)).toBe(4);

    const allIds = dump.parts.flatMap((bytes) => decodeDump(bytes).docs.map((d) => d._id));
    expect(allIds.sort()).toEqual(
      ["article:test__a", "article:test__b", "article:test__c", "section:test"].sort(),
    );
  });
});

describe("writeBackupParts: writing the auto-backup as one file or manifest+parts", () => {
  it("one part — writes exactly one file under the original name", async () => {
    const filePort = createFakeFilePort();
    const dump = { header: buildDumpHeader(1), parts: [encodeDump({ header: buildDumpHeader(1), docs: [] })], docCounts: [1] };

    await writeBackupParts(filePort, "backup.json", dump);

    expect([...filePort.files.keys()]).toEqual(["backups/backup.json"]);
  });

  it("several parts — writes a manifest + numbered parts, the manifest references the real names", async () => {
    const filePort = createFakeFilePort();
    const header = buildDumpHeader(3);
    const dump = {
      header,
      parts: [
        encodeDump({ header: { ...header, docCount: 2 }, docs: [] }),
        encodeDump({ header: { ...header, docCount: 1 }, docs: [] }),
      ],
      docCounts: [2, 1],
    };

    await writeBackupParts(filePort, "backup.json", dump);

    expect([...filePort.files.keys()].sort()).toEqual(
      ["backups/backup.manifest.json", "backups/backup.part001.json", "backups/backup.part002.json"].sort(),
    );
    const manifest = decodeManifest(filePort.files.get("backups/backup.manifest.json")!);
    expect(manifest.totalDocCount).toBe(3);
    expect(manifest.parts).toEqual([
      { file: "backup.part001.json", docCount: 2 },
      { file: "backup.part002.json", docCount: 1 },
    ]);
  });
});

describe("exportDatabaseToFile: an explicit refusal instead of a RangeError when the database does not fit in one file", () => {
  it("throws ExportTooLargeForSingleFileError and does NOT show the location picker dialog", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    await contentDb.put(makeArticleDoc("article:test__a", "A", "section:test", "2026-01-01T00:00:00.000Z"));
    await contentDb.put(makeArticleDoc("article:test__b", "B", "section:test", "2026-01-01T00:00:00.000Z"));

    const filePort = createFakeFilePort();
    let pickSaveLocationCalls = 0;
    filePort.pickSaveLocation = async (suggestedName) => {
      pickSaveLocationCalls += 1;
      return suggestedName;
    };

    await expect(exportDatabaseToFile(filePort, contentDb, systemDb, 200)).rejects.toThrow(
      ExportTooLargeForSingleFileError,
    );
    expect(pickSaveLocationCalls).toBe(0); // refusal BEFORE the dialog, not after the user already picked a file
    expect(filePort.files.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

describe("importContentDumpParts: merging several parts", () => {
  it("one part — same as importContentDump (the wrapper is checked for equal behavior)", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const dump: ContentDump = {
      header: buildDumpHeader(1),
      docs: [makeDumpArticleDoc("article:test__a", "A", "section:test", "2026-01-01T00:00:00.000Z")],
    };
    const report = await importContentDumpParts(contentDb, systemDb, [encodeDump(dump)], 1, noopBackup);
    expect(report.merged).toBe(1);
    expect(report.created).toBe(1);
  });

  it("several parts all merge; documents are neither lost nor doubled", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const part1: ContentDump = {
      header: buildDumpHeader(2),
      docs: [
        makeDumpArticleDoc("article:test__a", "A", "section:test", "2026-01-01T00:00:00.000Z"),
        makeDumpArticleDoc("article:test__b", "B", "section:test", "2026-01-01T00:00:00.000Z"),
      ],
    };
    const part2: ContentDump = {
      header: buildDumpHeader(1),
      docs: [makeDumpArticleDoc("article:test__c", "C", "section:test", "2026-01-01T00:00:00.000Z")],
    };

    const report = await importContentDumpParts(
      contentDb,
      systemDb,
      [encodeDump(part1), encodeDump(part2)],
      2,
      noopBackup,
    );

    expect(report.merged).toBe(3);
    expect(report.created).toBe(3);
    expect((await contentDb.get("article:test__a") as unknown as { title: string }).title).toBe("A");
    expect((await contentDb.get("article:test__b") as unknown as { title: string }).title).toBe("B");
    expect((await contentDb.get("article:test__c") as unknown as { title: string }).title).toBe("C");
  });

  it("progress fires once per part, with a growing docsMergedSoFar", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const part1: ContentDump = {
      header: buildDumpHeader(2),
      docs: [
        makeDumpArticleDoc("article:test__a", "A", "section:test", "2026-01-01T00:00:00.000Z"),
        makeDumpArticleDoc("article:test__b", "B", "section:test", "2026-01-01T00:00:00.000Z"),
      ],
    };
    const part2: ContentDump = {
      header: buildDumpHeader(1),
      docs: [makeDumpArticleDoc("article:test__c", "C", "section:test", "2026-01-01T00:00:00.000Z")],
    };

    const progress: ImportProgress[] = [];
    await importContentDumpParts(
      contentDb,
      systemDb,
      [encodeDump(part1), encodeDump(part2)],
      2,
      noopBackup,
      (p) => progress.push(p),
      () => 3,
    );

    expect(progress).toHaveLength(2);
    expect(progress[0]).toMatchObject({ phase: "merging", fileIndex: 1, totalFiles: 2, docsMergedSoFar: 2, totalDocsHint: 3 });
    expect(progress[1]).toMatchObject({ phase: "merging", fileIndex: 2, totalFiles: 2, docsMergedSoFar: 3, totalDocsHint: 3 });
  });

  it("a conflict between the parts and the local database is resolved once, after ALL parts are merged", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const REV_LOCAL = "1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    await contentDb.bulkDocs(
      [{ ...makeArticleDoc("article:test__x", "Local (old)", "section:test", "2026-01-01T00:00:00.000Z"), _rev: REV_LOCAL }],
      { new_edits: false },
    );

    const part1: ContentDump = {
      header: buildDumpHeader(1),
      docs: [makeDumpArticleDoc("article:test__y", "Y (a new document)", "section:test", "2026-01-01T00:00:00.000Z")],
    };
    const part2: ContentDump = {
      header: buildDumpHeader(1),
      docs: [
        { ...makeArticleDoc("article:test__x", "Imported (new)", "section:test", "2026-06-01T00:00:00.000Z"), _rev: nextSyntheticRev() } as unknown as DumpDoc,
      ],
    };

    const report = await importContentDumpParts(contentDb, systemDb, [encodeDump(part1), encodeDump(part2)], 2, noopBackup);

    expect(report.conflictsResolved).toBe(1);
    expect(report.resolutions[0]).toMatchObject({ docId: "article:test__x", wonBy: "imported" });
    const finalX = await contentDb.get("article:test__x");
    expect((finalX as unknown as { title: string }).title).toBe("Imported (new)");
  });

  it("if the FIRST part has a foreign schemaVersion, the whole import is cancelled BEFORE the auto-backup", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const badPart: ContentDump = { header: { ...buildDumpHeader(0), schemaVersion: 999 }, docs: [] };
    const goodPart: ContentDump = {
      header: buildDumpHeader(1),
      docs: [makeDumpArticleDoc("article:test__a", "A", "section:test", "2026-01-01T00:00:00.000Z")],
    };
    const backup = vi.fn();

    await expect(
      importContentDumpParts(contentDb, systemDb, [encodeDump(badPart), encodeDump(goodPart)], 2, backup),
    ).rejects.toThrow(DumpSchemaVersionError);
    expect(backup).not.toHaveBeenCalled();
    await expect(contentDb.get("article:test__a")).rejects.toMatchObject({ status: 404 });
  });

  it("parts are read and merged as a STREAM: if a problem shows up past the first part, the earlier ones are already merged (the backup is already taken and can restore if needed)", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const goodPart: ContentDump = {
      header: buildDumpHeader(1),
      docs: [makeDumpArticleDoc("article:test__a", "A", "section:test", "2026-01-01T00:00:00.000Z")],
    };
    const badPart: ContentDump = { header: { ...buildDumpHeader(0), schemaVersion: 999 }, docs: [] };
    const backup = vi.fn();

    await expect(
      importContentDumpParts(contentDb, systemDb, [encodeDump(goodPart), encodeDump(badPart)], 2, backup),
    ).rejects.toThrow(DumpSchemaVersionError);
    expect(backup).toHaveBeenCalledTimes(1);
    const restored = await contentDb.get("article:test__a");
    expect((restored as unknown as { title: string }).title).toBe("A");
  });
});

describe("importDatabaseFromFiles: multi-selection orchestration through FilePort", () => {
  function makeManifest(parts: { file: string; docCount: number }[]): DumpManifest {
    return {
      dumpFormatVersion: 1,
      schemaVersion: buildDumpHeader(0).schemaVersion,
      createdAt: "2026-07-29T00:00:00.000Z",
      totalDocCount: parts.reduce((sum, p) => sum + p.docCount, 0),
      parts,
    };
  }

  it("manifest + parts: merges all parts, totalDocsHint from the manifest reaches the progress", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const part1: ContentDump = {
      header: buildDumpHeader(1),
      docs: [makeDumpArticleDoc("article:test__a", "A", "section:test", "2026-01-01T00:00:00.000Z")],
    };
    const manifest = makeManifest([{ file: "bundle.part001.json", docCount: 1 }]);

    const filePort = createFakeFilePort([], [["manifest.json", "part1.json"]]);
    filePort.files.set("manifest.json", new TextEncoder().encode(JSON.stringify(manifest)));
    filePort.files.set("part1.json", encodeDump(part1));

    const progress: ImportProgress[] = [];
    const report = await importDatabaseFromFiles(filePort, contentDb, systemDb, (p) => progress.push(p));

    expect(report).not.toBeNull();
    expect(report!.merged).toBe(1);
    expect(progress.some((p) => p.phase === "reading")).toBe(true);
    expect(progress.some((p) => p.phase === "merging" && p.totalDocsHint === 1)).toBe(true);
  });

  it("parts only, no manifest — also works (the manifest is optional)", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const part1: ContentDump = {
      header: buildDumpHeader(1),
      docs: [makeDumpArticleDoc("article:test__a", "A", "section:test", "2026-01-01T00:00:00.000Z")],
    };
    const filePort = createFakeFilePort([], [["part1.json"]]);
    filePort.files.set("part1.json", encodeDump(part1));

    const report = await importDatabaseFromFiles(filePort, contentDb, systemDb);
    expect(report).not.toBeNull();
    expect(report!.created).toBe(1);
  });

  it("only the manifest selected, no parts — a clear error, the database untouched", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const manifest = makeManifest([{ file: "bundle.part001.json", docCount: 1 }]);
    const filePort = createFakeFilePort([], [["manifest.json"]]);
    filePort.files.set("manifest.json", new TextEncoder().encode(JSON.stringify(manifest)));

    await expect(importDatabaseFromFiles(filePort, contentDb, systemDb)).rejects.toThrow(
      ImportManifestPartsMissingError,
    );
  });

  it("cancelling file selection (pickFiles -> null) leaves the database alone", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test"));
    const filePort = createFakeFilePort([], []); // pickFiles always returns null

    const report = await importDatabaseFromFiles(filePort, contentDb, systemDb);
    expect(report).toBeNull();
  });
});
