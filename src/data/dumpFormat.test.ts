import { describe, expect, it } from "vitest";
import {
  DUMP_FORMAT_VERSION,
  DumpParseError,
  buildDumpHeader,
  buildManifest,
  decodeDump,
  decodeManifest,
  defaultBackupFileName,
  defaultDumpFileName,
  encodeDump,
  encodeManifest,
  estimateDocBytes,
  isDumpManifest,
  manifestFileName,
  partFileName,
  splitDocsIntoParts,
} from "./dumpFormat";
import type { DumpDoc, DumpManifest } from "./dumpFormat";
import { SCHEMA_VERSION } from "./types";

describe("buildDumpHeader", () => {
  it("builds a header with the app's current schemaVersion and the document count", () => {
    const header = buildDumpHeader(42, new Date("2026-07-28T12:00:00.000Z"));
    expect(header).toEqual({
      dumpFormatVersion: DUMP_FORMAT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      createdAt: "2026-07-28T12:00:00.000Z",
      docCount: 42,
    });
  });
});

describe("encodeDump / decodeDump", () => {
  it("round-trip: whatever is encoded decodes back the same", () => {
    const header = buildDumpHeader(1, new Date("2026-07-28T12:00:00.000Z"));
    const docs = [{ _id: "article:test__x", _rev: "1-abc", title: "X" } as never];
    const bytes = encodeDump({ header, docs });
    const decoded = decodeDump(bytes);
    expect(decoded.header).toEqual(header);
    expect(decoded.docs).toEqual(docs);
  });

  it("throws DumpParseError on non-JSON", () => {
    const bytes = new TextEncoder().encode("this is not json {{{");
    expect(() => decodeDump(bytes)).toThrow(DumpParseError);
  });

  it("throws DumpParseError when header/docs are missing", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ foo: "bar" }));
    expect(() => decodeDump(bytes)).toThrow(DumpParseError);
  });

  it("throws DumpParseError when the header lacks schemaVersion", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ header: {}, docs: [] }));
    expect(() => decodeDump(bytes)).toThrow(DumpParseError);
  });
});

describe("isDumpManifest / decodeManifest", () => {
  const manifest: DumpManifest = {
    dumpFormatVersion: 1,
    schemaVersion: SCHEMA_VERSION,
    createdAt: "2026-07-29T00:00:00.000Z",
    totalDocCount: 3,
    parts: [
      { file: "bundle.part001.json", docCount: 2 },
      { file: "bundle.part002.json", docCount: 1 },
    ],
  };

  it("isDumpManifest tells a manifest (parts[]) apart from a dump part (docs[])", () => {
    expect(isDumpManifest(manifest)).toBe(true);
    expect(isDumpManifest({ header: {}, docs: [] })).toBe(false);
    expect(isDumpManifest(null)).toBe(false);
    expect(isDumpManifest("not an object")).toBe(false);
  });

  it("decodeManifest: round-trip", () => {
    const bytes = new TextEncoder().encode(JSON.stringify(manifest));
    expect(decodeManifest(bytes)).toEqual(manifest);
  });

  it("decodeManifest throws DumpParseError on non-JSON", () => {
    const bytes = new TextEncoder().encode("not json {{{");
    expect(() => decodeManifest(bytes)).toThrow(DumpParseError);
  });

  it("decodeManifest throws DumpParseError when parts/totalDocCount are missing", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ header: {}, docs: [] }));
    expect(() => decodeManifest(bytes)).toThrow(DumpParseError);
  });
});

describe("defaultDumpFileName / defaultBackupFileName", () => {
  it("contain the creation date and time and differ by purpose", () => {
    const now = new Date("2026-07-28T23:05:09.000Z");
    const dumpName = defaultDumpFileName(now);
    const backupName = defaultBackupFileName(now);
    expect(dumpName).toMatch(/2026-07-28/);
    expect(dumpName.endsWith(".json")).toBe(true);
    expect(backupName).toMatch(/2026-07-28/);
    expect(backupName).toContain("backup");
    expect(dumpName).not.toBe(backupName);
  });
});

function makeDoc(id: string, payloadChars: number): DumpDoc {
  return {
    _id: id,
    _rev: "1-test",
    type: "article",
    payload: "x".repeat(payloadChars),
  } as unknown as DumpDoc;
}

describe("estimateDocBytes", () => {
  it("grows with the size of the document content", () => {
    const small = estimateDocBytes(makeDoc("a", 10));
    const big = estimateDocBytes(makeDoc("b", 10_000));
    expect(big).toBeGreaterThan(small);
  });
});

describe("splitDocsIntoParts", () => {
  it("empty document list yields a single empty part", () => {
    expect(splitDocsIntoParts([], 1000)).toEqual([[]]);
  });

  it("everything fits under the threshold - a single part", () => {
    const docs = [makeDoc("a", 10), makeDoc("b", 10), makeDoc("c", 10)];
    const parts = splitDocsIntoParts(docs, 10_000);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toHaveLength(3);
  });

  it("splits into several parts by accumulated size without losing or duplicating documents", () => {
    const docs = [makeDoc("a", 200), makeDoc("b", 200), makeDoc("c", 200), makeDoc("d", 200)];
    const maxPartBytes = estimateDocBytes(docs[0]) * 2 + 10;
    const parts = splitDocsIntoParts(docs, maxPartBytes);

    expect(parts.length).toBeGreaterThan(1);
    const allIds = parts.flat().map((d) => d._id);
    expect(allIds.sort()).toEqual(["a", "b", "c", "d"]);
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0); // there must be no empty "tails"
    }
  });

  it("a document larger than the threshold gets a whole part instead of being split", () => {
    const hugeDoc = makeDoc("huge", 10_000);
    const tinyDoc = makeDoc("tiny", 10);
    const maxPartBytes = 100; // smaller than even a single document

    const parts = splitDocsIntoParts([hugeDoc, tinyDoc], maxPartBytes);

    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual([hugeDoc]);
    expect(parts[1]).toEqual([tinyDoc]);
  });
});

describe("manifestFileName / partFileName", () => {
  it("inserts .manifest/.partNNN before the extension", () => {
    expect(manifestFileName("aurora-backup-2026-08-01.json")).toBe("aurora-backup-2026-08-01.manifest.json");
    expect(partFileName("aurora-backup-2026-08-01.json", 0)).toBe("aurora-backup-2026-08-01.part001.json");
    expect(partFileName("aurora-backup-2026-08-01.json", 9)).toBe("aurora-backup-2026-08-01.part010.json");
  });

  it("also works without an extension in the base name", () => {
    expect(manifestFileName("aurora-backup")).toBe("aurora-backup.manifest");
    expect(partFileName("aurora-backup", 0)).toBe("aurora-backup.part001");
  });
});

describe("buildManifest / encodeManifest / decodeManifest (parts assembled in the app, not only scripts/pack_bundle.py)", () => {
  it("encodes and reads back as a manifest of the same shape", () => {
    const header = buildDumpHeader(3, new Date("2026-08-01T00:00:00.000Z"));
    const manifest = buildManifest(header, 3, [
      { file: "d.part001.json", docCount: 2 },
      { file: "d.part002.json", docCount: 1 },
    ]);

    const bytes = encodeManifest(manifest);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));

    expect(isDumpManifest(parsed)).toBe(true);
    const decoded = decodeManifest(bytes);
    expect(decoded.totalDocCount).toBe(3);
    expect(decoded.parts).toEqual(manifest.parts);
    expect(decoded.schemaVersion).toBe(header.schemaVersion);
  });
});
