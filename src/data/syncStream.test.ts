import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import { createContentDb, createSystemDb } from "./db";
import {
  buildDumpHeader,
  decodeDump,
  decodeManifest,
  encodeDump,
  encodeDumpDoc,
  encodeDumpFromEncodedDocs,
} from "./dumpFormat";
import type { DumpDoc } from "./dumpFormat";
import {
  DEFAULT_EXPORT_PAGE_SIZE,
  ExportSiblingLocationUnsupportedError,
  exportContentDumpParts,
  exportDatabaseToFiles,
  streamContentDumpParts,
  writeBackupStream,
  writeContentDumpStream,
} from "./sync";
import type { FileHandle, FilePort } from "./filePort";
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

function makeArticleDoc(id: string, title: string, updatedAt = "2026-01-01T00:00:00.000Z") {
  return {
    _id: id,
    type: "article",
    schemaVersion: 1,
    title,
    sectionId: "section:test",
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

async function putDocWithAttachment(db: PouchDB.Database, id: string, attachmentBytes: number): Promise<void> {
  await db.put(makeArticleDoc(id, id));
  const doc = await db.get(id);
  const payload = uint8ArrayToBase64(new Uint8Array(attachmentBytes).fill(65));
  await db.putAttachment(id, "blob", doc._rev, payload, "application/octet-stream");
}

function createFakeFilePort(): FilePort & { files: Map<string, Uint8Array>; writeOrder: string[] } {
  const files = new Map<string, Uint8Array>();
  const writeOrder: string[] = [];
  return {
    files,
    writeOrder,
    async writeDump(location, data) {
      files.set(location as string, data);
      writeOrder.push(location as string);
    },
    async readDump(handle) {
      const bytes = files.get(handle as string);
      if (!bytes) throw new Error("file not found in the stub");
      return bytes;
    },
    async pickFile() {
      return null;
    },
    async pickFiles() {
      return null;
    },
    async pickSaveLocation(suggestedName) {
      return `chosen/${suggestedName}`;
    },
    async getAutoBackupLocation(suggestedName) {
      return `backups/${suggestedName}`;
    },
    async siblingLocation(location, fileName) {
      return (location as string).replace(/[^/]*$/, fileName);
    },
  };
}

describe("encodeDumpFromEncodedDocs: the format did not change by a single byte", () => {
  it("assembling a part from individually encoded documents yields the SAME bytes as encodeDump of the whole", () => {
    const header = buildDumpHeader(2, new Date("2026-08-10T00:00:00.000Z"));
    const docs = [
      { ...makeArticleDoc("article:a", "Кириллица и \"кавычки\""), _rev: "1-a" },
      { ...makeArticleDoc("article:b", "Second"), _rev: "1-b" },
    ] as unknown as DumpDoc[];

    const whole = encodeDump({ header, docs });
    const streamed = encodeDumpFromEncodedDocs(header, docs.map(encodeDumpDoc));

    expect(streamed).toEqual(whole);
  });

  it("an empty part is also byte-for-byte the same as encodeDump with an empty document array", () => {
    const header = buildDumpHeader(0, new Date("2026-08-10T00:00:00.000Z"));
    expect(encodeDumpFromEncodedDocs(header, [])).toEqual(encodeDump({ header, docs: [] }));
  });

  it("the encoded document length matches the one used to compute the part threshold", () => {
    const doc = { ...makeArticleDoc("article:a", "Test"), _rev: "1-a" } as unknown as DumpDoc;
    expect(encodeDumpDoc(doc).length).toBe(new TextEncoder().encode(JSON.stringify(doc)).length);
  });
});

describe("streamContentDumpParts: reading the database in pages", () => {
  it("yields every document of the database, none lost or doubled (more documents than one page)", async () => {
    const total = DEFAULT_EXPORT_PAGE_SIZE * 3 + 1;
    for (let i = 0; i < total; i += 1) {
      await contentDb.put(makeArticleDoc(`article:doc-${String(i).padStart(3, "0")}`, `Doc ${i}`));
    }

    const ids: string[] = [];
    for await (const part of streamContentDumpParts(contentDb)) {
      ids.push(...decodeDump(part.bytes).docs.map((d) => d._id));
    }

    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
  });

  it("an empty database — exactly one empty part (the caller always gets at least one)", async () => {
    const parts = [];
    for await (const part of streamContentDumpParts(contentDb)) parts.push(part);
    expect(parts).toHaveLength(1);
    expect(parts[0].docCount).toBe(0);
    expect(decodeDump(parts[0].bytes).docs).toEqual([]);
  });

  it("does not export service _design documents", async () => {
    await contentDb.createIndex({ index: { fields: ["sectionId"], name: "idx", ddoc: "idx" } });
    await contentDb.put(makeArticleDoc("article:a", "A"));

    const ids: string[] = [];
    for await (const part of streamContentDumpParts(contentDb)) {
      ids.push(...decodeDump(part.bytes).docs.map((d) => d._id));
    }
    expect(ids).toEqual(["article:a"]);
  });

  it("all parts carry ONE shared createdAt/schemaVersion — the way scripts/pack_bundle.py writes them", async () => {
    for (let i = 0; i < 5; i += 1) await contentDb.put(makeArticleDoc(`article:doc-${i}`, `Doc ${i}`));

    const headers = [];
    for await (const part of streamContentDumpParts(contentDb, 200)) headers.push(part.header);

    expect(headers.length).toBeGreaterThan(1);
    expect(new Set(headers.map((h) => h.createdAt)).size).toBe(1);
    expect(new Set(headers.map((h) => h.schemaVersion)).size).toBe(1);
    expect(headers.reduce((sum, h) => sum + h.docCount, 0)).toBe(5);
  });

  it("a document bigger than the part threshold by itself gets a whole part (expected, always worked this way)", async () => {
    await putDocWithAttachment(contentDb, "article:big", 4096);
    await contentDb.put(makeArticleDoc("article:small", "Small"));

    const parts = [];
    for await (const part of streamContentDumpParts(contentDb, 1024)) parts.push(part);

    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.docCount >= 1)).toBe(true);
  });

  it("peak consumption is bounded by ONE part: the parts sum to many times the largest part", async () => {
    for (let i = 0; i < 12; i += 1) {
      await putDocWithAttachment(contentDb, `article:big-${String(i).padStart(2, "0")}`, 64 * 1024);
    }

    let totalBytes = 0;
    let maxPartBytes = 0;
    let partCount = 0;
    for await (const part of streamContentDumpParts(contentDb, 128 * 1024)) {
      totalBytes += part.bytes.byteLength;
      maxPartBytes = Math.max(maxPartBytes, part.bytes.byteLength);
      partCount += 1;
    }

    expect(partCount).toBeGreaterThan(4);
    expect(maxPartBytes).toBeLessThan(totalBytes / 3);
  });
});

describe("exportContentDumpParts over the stream: the previous contract is kept", () => {
  it("the header carries the TOTAL document count, docCounts the partial ones", async () => {
    for (let i = 0; i < 5; i += 1) await contentDb.put(makeArticleDoc(`article:doc-${i}`, `Doc ${i}`));

    const dump = await exportContentDumpParts(contentDb, 200);

    expect(dump.header.docCount).toBe(5);
    expect(dump.docCounts.reduce((a, b) => a + b, 0)).toBe(5);
    expect(dump.parts).toHaveLength(dump.docCounts.length);
    dump.parts.forEach((bytes, i) => {
      expect(decodeDump(bytes).header.docCount).toBe(dump.docCounts[i]);
    });
  });
});

describe("writeContentDumpStream: a part is written to disk before the next one is read", () => {
  it("one part — exactly one file under the original name, no manifest", async () => {
    await contentDb.put(makeArticleDoc("article:a", "A"));
    const filePort = createFakeFilePort();

    const written = await writeBackupStream(filePort, "backup.json", contentDb);

    expect(written.partCount).toBe(1);
    expect(written.docCount).toBe(1);
    expect([...filePort.files.keys()]).toEqual(["backups/backup.json"]);
    expect(written.fileNames).toEqual(["backup.json"]);
  });

  it("several parts — the same names and the same manifest that writeBackupParts used to write", async () => {
    for (let i = 0; i < 4; i += 1) await contentDb.put(makeArticleDoc(`article:doc-${i}`, `Doc ${i}`));
    const filePort = createFakeFilePort();

    const written = await writeBackupStream(filePort, "backup.json", contentDb, 200);

    expect(written.partCount).toBeGreaterThan(1);
    const manifest = decodeManifest(filePort.files.get("backups/backup.manifest.json")!);
    expect(manifest.totalDocCount).toBe(4);
    expect(manifest.parts.map((p) => p.file)).toEqual(
      written.fileNames.filter((n) => n.includes(".part")),
    );
    expect(manifest.parts.reduce((sum, p) => sum + p.docCount, 0)).toBe(4);
  });

  it("the manifest is written LAST: its presence on disk means the parts are fully written", async () => {
    for (let i = 0; i < 4; i += 1) await contentDb.put(makeArticleDoc(`article:doc-${i}`, `Doc ${i}`));
    const filePort = createFakeFilePort();

    await writeBackupStream(filePort, "backup.json", contentDb, 200);

    expect(filePort.writeOrder[filePort.writeOrder.length - 1]).toBe("backups/backup.manifest.json");
  });

  it("parts really are written one at a time: by the time the second is read, the first is already on disk", async () => {
    for (let i = 0; i < 6; i += 1) await contentDb.put(makeArticleDoc(`article:doc-${i}`, `Doc ${i}`));
    const filePort = createFakeFilePort();

    const sizesDuringWrite: number[] = [];
    const originalWrite = filePort.writeDump.bind(filePort);
    filePort.writeDump = async (location, data) => {
      sizesDuringWrite.push(filePort.files.size);
      await originalWrite(location, data);
    };

    await writeBackupStream(filePort, "backup.json", contentDb, 200);

    expect(sizesDuringWrite.length).toBeGreaterThan(2);
    expect(sizesDuringWrite).toEqual(sizesDuringWrite.map((_, i) => i));
  });

  it("a written multi-part set reads back as a regular bundle", async () => {
    for (let i = 0; i < 5; i += 1) await contentDb.put(makeArticleDoc(`article:doc-${i}`, `Doc ${i}`));
    const filePort = createFakeFilePort();

    const written = await writeBackupStream(filePort, "backup.json", contentDb, 200);

    const idsOnDisk = written.fileNames
      .filter((name) => name.includes(".part"))
      .flatMap((name) => decodeDump(filePort.files.get(`backups/${name}`)!).docs.map((d) => d._id));
    expect(idsOnDisk.sort()).toEqual(
      ["article:doc-0", "article:doc-1", "article:doc-2", "article:doc-3", "article:doc-4"].sort(),
    );
  });
});

describe("exportDatabaseToFiles: manual export is no longer a dead end on a big database", () => {
  it("a small database — one file exactly where the user pointed (behavior as before)", async () => {
    await contentDb.put(makeArticleDoc("article:a", "A"));
    const filePort = createFakeFilePort();

    const result = await exportDatabaseToFiles(filePort, contentDb, systemDb);

    expect(result).not.toBeNull();
    expect(result!.partCount).toBe(1);
    expect(result!.docCount).toBe(1);
    expect([...filePort.files.keys()]).toHaveLength(1);
    expect([...filePort.files.keys()][0]).toMatch(/^chosen\/aurora-dump-.*\.json$/);
  });

  it("a database that does not fit in one file is exported as parts side by side — WITHOUT a second dialog", async () => {
    for (let i = 0; i < 5; i += 1) await contentDb.put(makeArticleDoc(`article:doc-${i}`, `Doc ${i}`));
    const filePort = createFakeFilePort();
    let dialogs = 0;
    const originalPick = filePort.pickSaveLocation.bind(filePort);
    filePort.pickSaveLocation = async (name, title) => {
      dialogs += 1;
      return originalPick(name, title);
    };

    const result = await exportDatabaseToFiles(filePort, contentDb, systemDb, 200);

    expect(dialogs).toBe(1);
    expect(result!.partCount).toBeGreaterThan(1);
    expect(result!.docCount).toBe(5);
    expect([...filePort.files.keys()].every((k) => k.startsWith("chosen/"))).toBe(true);
    expect([...filePort.files.keys()].some((k) => k.includes(".manifest."))).toBe(true);
  });

  it("the export is logged to the applog once, with the total document count", async () => {
    for (let i = 0; i < 5; i += 1) await contentDb.put(makeArticleDoc(`article:doc-${i}`, `Doc ${i}`));
    const filePort = createFakeFilePort();

    await exportDatabaseToFiles(filePort, contentDb, systemDb, 200);

    const rows = await systemDb.allDocs({ startkey: "applog:", endkey: "applog:￿", include_docs: true });
    expect(rows.rows).toHaveLength(1);
    expect((rows.rows[0].doc as unknown as { context: { docCount: number } }).context.docCount).toBe(5);
  });

  it("cancelling the dialog — nothing is written or logged", async () => {
    await contentDb.put(makeArticleDoc("article:a", "A"));
    const filePort = createFakeFilePort();
    filePort.pickSaveLocation = async () => null;

    const result = await exportDatabaseToFiles(filePort, contentDb, systemDb);

    expect(result).toBeNull();
    expect(filePort.files.size).toBe(0);
  });

  it("a port without siblingLocation: single-file export works, multi-part refuses clearly", async () => {
    const filePort = createFakeFilePort();
    delete (filePort as { siblingLocation?: unknown }).siblingLocation;

    await contentDb.put(makeArticleDoc("article:a", "A"));
    await expect(exportDatabaseToFiles(filePort, contentDb, systemDb)).resolves.not.toBeNull();

    for (let i = 0; i < 5; i += 1) await contentDb.put(makeArticleDoc(`article:doc-${i}`, `Doc ${i}`));
    await expect(exportDatabaseToFiles(filePort, contentDb, systemDb, 200)).rejects.toThrow(
      ExportSiblingLocationUnsupportedError,
    );
  });
});

describe("writeContentDumpStream: an arbitrary resolveLocation", () => {
  it("the file name is handed to resolveLocation; the caller chooses the location", async () => {
    await contentDb.put(makeArticleDoc("article:a", "A"));
    const filePort = createFakeFilePort();
    const asked: string[] = [];

    await writeContentDumpStream(filePort, "dump.json", contentDb, async (fileName) => {
      asked.push(fileName);
      return `custom/${fileName}` as FileHandle;
    });

    expect(asked).toEqual(["dump.json"]);
    expect([...filePort.files.keys()]).toEqual(["custom/dump.json"]);
  });
});
