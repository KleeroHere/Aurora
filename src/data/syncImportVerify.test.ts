import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import { createContentDb, createSystemDb } from "./db";
import { buildDumpHeader, encodeDump, encodeManifest, buildManifest } from "./dumpFormat";
import type { ContentDump, DumpDoc, DumpManifest } from "./dumpFormat";
import {
  ImportBundleSelectionError,
  ImportDocCountMismatchError,
  ImportDocsRejectedError,
  ImportManifestPartsMissingError,
  ImportMultipleManifestsError,
  ImportPartParseError,
  importContentDumpParts,
  importDatabaseFromFiles,
  verifyBundleSelection,
} from "./sync";
import type { FileHandle, FilePort } from "./filePort";

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

let revCounter = 0;
function nextRev(): string {
  revCounter += 1;
  return `1-${revCounter.toString(16).padStart(32, "0")}`;
}

function makeDumpDoc(id: string, title = id): DumpDoc {
  return {
    _id: id,
    _rev: nextRev(),
    type: "article",
    schemaVersion: 1,
    title,
    sectionId: "section:test",
    tags: [],
    card: { color: "neutral", cover: null },
    order: 1,
    createdBy: "migration",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedBy: "migration",
    updatedAt: "2026-01-01T00:00:00.000Z",
    legacy: null,
    body: { time: 1, blocks: [], version: "2.31.6" },
    plainText: title,
    excerpt: title,
    readingTime: 1,
  } as unknown as DumpDoc;
}

function dumpWith(docs: DumpDoc[]): Uint8Array {
  const dump: ContentDump = { header: buildDumpHeader(docs.length), docs };
  return encodeDump(dump);
}

function createNamedFilePort(selection: string[]): FilePort & { files: Map<string, Uint8Array>; reads: string[] } {
  const files = new Map<string, Uint8Array>();
  const reads: string[] = [];
  return {
    files,
    reads,
    async writeDump(location, data) {
      files.set(location as string, data);
    },
    async readDump(handle) {
      reads.push(handle as string);
      const bytes = files.get(handle as string);
      if (!bytes) throw new Error(`file not found in the stub: ${String(handle)}`);
      return bytes;
    },
    async pickFile() {
      return null;
    },
    async pickFiles() {
      return selection as FileHandle[];
    },
    async pickSaveLocation(suggestedName) {
      return suggestedName;
    },
    async getAutoBackupLocation(suggestedName) {
      return `backups/${suggestedName}`;
    },
    fileName(handle) {
      return String(handle);
    },
  };
}

function manifestFor(parts: { file: string; docCount: number }[]): DumpManifest {
  return buildManifest(
    buildDumpHeader(0),
    parts.reduce((sum, p) => sum + p.docCount, 0),
    parts,
  );
}

describe("verifyBundleSelection: checking the selected set against the manifest", () => {
  const manifest = manifestFor([
    { file: "bundle.part001.json", docCount: 2 },
    { file: "bundle.part002.json", docCount: 2 },
    { file: "bundle.part003.json", docCount: 1 },
  ]);

  it("a complete set passes", () => {
    expect(() =>
      verifyBundleSelection(manifest, ["bundle.part002.json", "bundle.part001.json", "bundle.part003.json"]),
    ).not.toThrow();
  });

  it("a missing part is an error, and the message NAMES the missing file", () => {
    try {
      verifyBundleSelection(manifest, ["bundle.part001.json", "bundle.part003.json"]);
      throw new Error("expected an error");
    } catch (err) {
      expect(err).toBeInstanceOf(ImportBundleSelectionError);
      expect((err as ImportBundleSelectionError).missing).toEqual(["bundle.part002.json"]);
      expect((err as Error).message).toContain("bundle.part002.json");
      expect((err as Error).message).toContain("database unchanged");
    }
  });

  it("a file from a FOREIGN bundle among the selection is also an error, named explicitly", () => {
    try {
      verifyBundleSelection(manifest, [
        "bundle.part001.json",
        "bundle.part002.json",
        "bundle.part003.json",
        "other.part001.json",
      ]);
      throw new Error("expected an error");
    } catch (err) {
      expect(err).toBeInstanceOf(ImportBundleSelectionError);
      expect((err as ImportBundleSelectionError).unexpected).toEqual(["other.part001.json"]);
    }
  });
});

describe("importDatabaseFromFiles: an incomplete set is cut off BEFORE side effects", () => {
  function seedBundle(port: ReturnType<typeof createNamedFilePort>): void {
    const manifest = manifestFor([
      { file: "bundle.part001.json", docCount: 1 },
      { file: "bundle.part002.json", docCount: 1 },
    ]);
    port.files.set("bundle.manifest.json", encodeManifest(manifest));
    port.files.set("bundle.part001.json", dumpWith([makeDumpDoc("article:a", "A")]));
    port.files.set("bundle.part002.json", dumpWith([makeDumpDoc("article:b", "B")]));
  }

  it("a part is missing: an error, the database is NOT changed, the auto-backup is NOT created", async () => {
    const filePort = createNamedFilePort(["bundle.manifest.json", "bundle.part001.json"]);
    seedBundle(filePort);

    await expect(importDatabaseFromFiles(filePort, contentDb, systemDb)).rejects.toThrow(ImportBundleSelectionError);

    await expect(contentDb.get("article:a")).rejects.toMatchObject({ status: 404 });
    expect([...filePort.files.keys()].some((k) => k.startsWith("backups/"))).toBe(false);
    expect(filePort.reads).toEqual(["bundle.manifest.json"]);
  });

  it("a complete set works as before: everything merged, a report with no rejections", async () => {
    const filePort = createNamedFilePort(["bundle.manifest.json", "bundle.part001.json", "bundle.part002.json"]);
    seedBundle(filePort);

    const report = await importDatabaseFromFiles(filePort, contentDb, systemDb);

    expect(report!.merged).toBe(2);
    expect(report!.created).toBe(2);
    expect(report!.failures).toEqual([]);
    expect((await contentDb.get("article:a") as unknown as { title: string }).title).toBe("A");
    expect((await contentDb.get("article:b") as unknown as { title: string }).title).toBe("B");
  });

  it("an extra file from another bundle is selected — an error before any database write", async () => {
    const filePort = createNamedFilePort([
      "bundle.manifest.json",
      "bundle.part001.json",
      "bundle.part002.json",
      "other.part001.json",
    ]);
    seedBundle(filePort);
    filePort.files.set("other.part001.json", dumpWith([makeDumpDoc("article:x", "X")]));

    await expect(importDatabaseFromFiles(filePort, contentDb, systemDb)).rejects.toThrow(ImportBundleSelectionError);
    await expect(contentDb.get("article:a")).rejects.toMatchObject({ status: 404 });
  });

  it("only the manifest selected — the same clear error as before, the database untouched", async () => {
    const filePort = createNamedFilePort(["bundle.manifest.json"]);
    seedBundle(filePort);

    await expect(importDatabaseFromFiles(filePort, contentDb, systemDb)).rejects.toThrow(
      ImportManifestPartsMissingError,
    );
  });

  it("manifests of two different bundles selected — a refusal listing both", async () => {
    const filePort = createNamedFilePort(["a.manifest.json", "b.manifest.json", "a.part001.json"]);
    filePort.files.set("a.manifest.json", encodeManifest(manifestFor([{ file: "a.part001.json", docCount: 1 }])));
    filePort.files.set("b.manifest.json", encodeManifest(manifestFor([{ file: "b.part001.json", docCount: 1 }])));
    filePort.files.set("a.part001.json", dumpWith([makeDumpDoc("article:a", "A")]));

    await expect(importDatabaseFromFiles(filePort, contentDb, systemDb)).rejects.toThrow(ImportMultipleManifestsError);
  });

  it("without a manifest (parts only) the import still works — the manifest is optional", async () => {
    const filePort = createNamedFilePort(["bundle.part001.json"]);
    seedBundle(filePort);

    const report = await importDatabaseFromFiles(filePort, contentDb, systemDb);
    expect(report!.created).toBe(1);
  });
});

describe("importDatabaseFromFiles: a corrupted file is named", () => {
  it("a broken part — the message names exactly that file, not \"one of the selection\"", async () => {
    const filePort = createNamedFilePort([
      "bundle.manifest.json",
      "bundle.part001.json",
      "bundle.part002.json",
    ]);
    filePort.files.set(
      "bundle.manifest.json",
      encodeManifest(
        manifestFor([
          { file: "bundle.part001.json", docCount: 1 },
          { file: "bundle.part002.json", docCount: 1 },
        ]),
      ),
    );
    filePort.files.set("bundle.part001.json", dumpWith([makeDumpDoc("article:a", "A")]));
    filePort.files.set("bundle.part002.json", new TextEncoder().encode("{not json"));

    const error = await importDatabaseFromFiles(filePort, contentDb, systemDb).catch((err) => err);

    expect(error).toBeInstanceOf(ImportPartParseError);
    expect((error as ImportPartParseError).fileName).toBe("bundle.part002.json");
    expect((error as Error).message).toContain("bundle.part002.json");
  });

  it("a broken manifest is named too, before the parts are read", async () => {
    const filePort = createNamedFilePort(["bundle.manifest.json", "bundle.part001.json"]);
    filePort.files.set("bundle.manifest.json", new TextEncoder().encode("{broken"));
    filePort.files.set("bundle.part001.json", dumpWith([makeDumpDoc("article:a", "A")]));

    const error = await importDatabaseFromFiles(filePort, contentDb, systemDb).catch((err) => err);
    expect(error).toBeInstanceOf(ImportPartParseError);
    expect((error as ImportPartParseError).fileName).toBe("bundle.manifest.json");
    expect(filePort.reads).toEqual(["bundle.manifest.json"]);
  });

  it("a port without fileName: no name — the ordinal number of the file is reported, not silence", async () => {
    const filePort = createNamedFilePort(["part1.json", "part2.json"]);
    delete (filePort as { fileName?: unknown }).fileName;
    filePort.files.set("part1.json", dumpWith([makeDumpDoc("article:a", "A")]));
    filePort.files.set("part2.json", new TextEncoder().encode("broken"));

    const error = await importDatabaseFromFiles(filePort, contentDb, systemDb).catch((err) => err);
    expect(error).toBeInstanceOf(ImportPartParseError);
    expect((error as Error).message).toContain("#2");
  });
});

describe("importContentDumpParts: the bulkDocs result is checked", () => {
  it("documents rejected by the database do not count as merged and land in the report with an error", async () => {
    const docs = [makeDumpDoc("article:ok", "OK"), makeDumpDoc("article:bad", "BAD")];
    const dump = encodeDump({ header: buildDumpHeader(2), docs });

    const realBulkDocs = contentDb.bulkDocs.bind(contentDb);
    vi.spyOn(contentDb, "bulkDocs").mockImplementation(async (input, options) => {
      const list = input as DumpDoc[];
      await realBulkDocs(list.filter((d) => d._id !== "article:bad") as never, options as never);
      return [
        { error: true, id: "article:bad", name: "forbidden", message: "no space left on disk", status: 403 },
      ] as never;
    });

    const error = await importContentDumpParts(contentDb, systemDb, [dump], 1, async () => undefined).catch(
      (err) => err,
    );

    expect(error).toBeInstanceOf(ImportDocsRejectedError);
    const report = (error as ImportDocsRejectedError).report;
    expect(report.merged).toBe(1); // and NOT 2, as it used to count by input array length
    expect(report.failures).toEqual([{ docId: "article:bad", reason: "no space left on disk" }]);
    expect((error as Error).message).toContain("article:bad");

    vi.restoreAllMocks();
  });

  it("an empty result array (full success with new_edits:false) — no rejections", async () => {
    const dump = encodeDump({ header: buildDumpHeader(1), docs: [makeDumpDoc("article:a", "A")] });
    const report = await importContentDumpParts(contentDb, systemDb, [dump], 1, async () => undefined);
    expect(report.failures).toEqual([]);
    expect(report.merged).toBe(1);
  });
});

describe("importContentDumpParts: checking against manifest.totalDocCount", () => {
  it("less merged than the manifest promised — an error naming how many are missing", async () => {
    const dump = encodeDump({ header: buildDumpHeader(1), docs: [makeDumpDoc("article:a", "A")] });

    const error = await importContentDumpParts(
      contentDb,
      systemDb,
      [dump],
      1,
      async () => undefined,
      undefined,
      () => 5, // the manifest promised five documents
    ).catch((err) => err);

    expect(error).toBeInstanceOf(ImportDocCountMismatchError);
    expect((error as ImportDocCountMismatchError).expected).toBe(5);
    expect((error as ImportDocCountMismatchError).report.merged).toBe(1);
    expect((error as Error).message).toContain("4 missing");
  });

  it("a match — the import finishes normally", async () => {
    const dump = encodeDump({ header: buildDumpHeader(2), docs: [makeDumpDoc("article:a"), makeDumpDoc("article:b")] });
    const report = await importContentDumpParts(
      contentDb,
      systemDb,
      [dump],
      1,
      async () => undefined,
      undefined,
      () => 2,
    );
    expect(report.merged).toBe(2);
  });

  it("no manifest — nothing to check against, the import works as before", async () => {
    const dump = encodeDump({ header: buildDumpHeader(1), docs: [makeDumpDoc("article:a")] });
    const report = await importContentDumpParts(contentDb, systemDb, [dump], 1, async () => undefined);
    expect(report.merged).toBe(1);
  });

  it("the mismatch still lands in the applog — in the morning you can see what happened", async () => {
    const dump = encodeDump({ header: buildDumpHeader(1), docs: [makeDumpDoc("article:a")] });
    await importContentDumpParts(contentDb, systemDb, [dump], 1, async () => undefined, undefined, () => 9).catch(
      () => undefined,
    );

    const rows = await systemDb.allDocs({ startkey: "applog:", endkey: "applog:￿", include_docs: true });
    expect(rows.rows).toHaveLength(1);
    expect((rows.rows[0].doc as unknown as { event: string }).event).toBe("sync.import");
  });
});
