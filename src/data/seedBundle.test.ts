import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import { createContentDb, createSystemDb } from "./db";
import { buildDumpHeader, buildManifest, encodeDump, encodeManifest, splitDocsIntoParts } from "./dumpFormat";
import type { DumpDoc } from "./dumpFormat";
import { gzipBytes, gunzipBytes } from "./gzip";
import { SEED_MANIFEST_NAME, SEED_STATE_ID, seedFromBundleIfNeeded } from "./seedBundle";
import type { SeedPort } from "./seedPort";
import type { FilePort, FileHandle } from "./filePort";
import { SCHEMA_VERSION } from "./types";
import type { SeedState } from "./types";

const SEED_FIXTURE_DIR = join(__dirname, "__fixtures__", "seed");

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

function makeFilePort(): FilePort {
  const written = new Map<string, Uint8Array>();
  return {
    async writeDump(location: FileHandle, data: Uint8Array): Promise<void> {
      written.set(location as string, data);
    },
    async readDump(location: FileHandle): Promise<Uint8Array> {
      return written.get(location as string) ?? new Uint8Array();
    },
    async pickFile() {
      return null;
    },
    async pickFiles() {
      return null;
    },
    async pickSaveLocation(suggestedName: string) {
      return suggestedName;
    },
    async getAutoBackupLocation(suggestedName: string) {
      return suggestedName;
    },
  };
}

function makeSeedPortFromFiles(files: Map<string, Uint8Array>): SeedPort {
  return {
    async hasSeedResource() {
      return files.has(SEED_MANIFEST_NAME);
    },
    async readSeedResource(name: string) {
      const bytes = files.get(name);
      if (!bytes) throw new Error(`fake SeedPort: resource "${name}" not found`);
      return bytes;
    },
  };
}

function makeEmptySeedPort(): SeedPort {
  return makeSeedPortFromFiles(new Map());
}

let syntheticRevCounter = 0;
function nextSyntheticRev(): string {
  syntheticRevCounter += 1;
  return `1-${syntheticRevCounter.toString(16).padStart(32, "0")}`;
}

function makeSectionDoc(id: string, title: string): DumpDoc {
  return {
    _id: id,
    _rev: nextSyntheticRev(),
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
  } as unknown as DumpDoc;
}

function makeArticleDoc(id: string, title: string, sectionId: string): DumpDoc {
  return {
    _id: id,
    _rev: nextSyntheticRev(),
    type: "article",
    schemaVersion: 1,
    title,
    sectionId,
    tags: [],
    card: { color: "neutral", cover: null },
    order: 1,
    createdBy: "migration",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedBy: "migration",
    updatedAt: "2026-01-01T00:00:00.000Z",
    legacy: null,
    body: { time: 0, blocks: [{ type: "paragraph", data: { text: title } }], version: "2.31.6" },
    plainText: title,
    excerpt: title,
    readingTime: 1,
  } as unknown as DumpDoc;
}

async function buildSeedFiles(docs: DumpDoc[], maxPartBytes = 1024 * 1024): Promise<Map<string, Uint8Array>> {
  const header = buildDumpHeader(docs.length);
  const groups = splitDocsIntoParts(docs, maxPartBytes);
  const files = new Map<string, Uint8Array>();
  const manifestParts = [];
  for (let i = 0; i < groups.length; i += 1) {
    const partBytes = encodeDump({ header: { ...header, docCount: groups[i].length }, docs: groups[i] });
    const gz = await gzipBytes(partBytes);
    const fileName = `bundle.part${String(i + 1).padStart(3, "0")}.json.gz`;
    files.set(fileName, gz);
    manifestParts.push({ file: fileName, docCount: groups[i].length });
  }
  const manifest = buildManifest(header, docs.length, manifestParts);
  files.set(SEED_MANIFEST_NAME, encodeManifest(manifest));
  return files;
}

describe("seedBundle.ts — auto-seeding on first launch (Flow G)", () => {
  it("no baked-in seed resource -> status 'absent', database untouched", async () => {
    const outcome = await seedFromBundleIfNeeded(contentDb, systemDb, makeFilePort(), makeEmptySeedPort());
    expect(outcome).toEqual({ status: "absent" });
    const info = await contentDb.info();
    expect(info.doc_count).toBe(0);
  });

  it("empty database + valid seed (2 documents, 1 part) -> seeds, writes the marker, a second run is idempotent", async () => {
    const docs = [
      makeSectionDoc("section:seed-a", "Seed section"),
      makeArticleDoc("article:seed-a__x", "Seed article", "section:seed-a"),
    ];
    const files = await buildSeedFiles(docs);
    const seedPort = makeSeedPortFromFiles(files);
    const filePort = makeFilePort();

    const first = await seedFromBundleIfNeeded(contentDb, systemDb, filePort, seedPort);
    expect(first).toEqual({ status: "seeded", docCount: 2 });

    const section = await contentDb.get("section:seed-a");
    expect((section as unknown as { title: string }).title).toBe("Seed section");
    const article = await contentDb.get("article:seed-a__x");
    expect((article as unknown as { title: string }).title).toBe("Seed article");

    const marker = (await systemDb.get(SEED_STATE_ID)) as unknown as SeedState;
    expect(marker.status).toBe("seeded");
    expect(marker.bundleDocCount).toBe(2);

    const second = await seedFromBundleIfNeeded(contentDb, systemDb, filePort, seedPort);
    expect(second.status).toBe("already-seeded");
    const infoAfter = await contentDb.info();
    expect(infoAfter.doc_count).toBe(2); // no doubling
  });

  it("the seed is split into several parts (manifest + 2 gz files) -> all parts are merged", async () => {
    const docs = [
      makeSectionDoc("section:seed-b", "Section B"),
      makeArticleDoc("article:seed-b__1", "Article B1", "section:seed-b"),
      makeArticleDoc("article:seed-b__2", "Article B2", "section:seed-b"),
    ];
    const files = await buildSeedFiles(docs, 200);
    const manifestBytes = files.get(SEED_MANIFEST_NAME)!;
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    expect(manifest.parts.length).toBeGreaterThan(1);

    const outcome = await seedFromBundleIfNeeded(contentDb, systemDb, makeFilePort(), makeSeedPortFromFiles(files));
    expect(outcome).toEqual({ status: "seeded", docCount: 3 });
    const info = await contentDb.info();
    expect(info.doc_count).toBe(3);
  });

  it("the database is ALREADY non-empty (by any means, not seeding), no marker yet -> seeding skipped, user data untouched", async () => {
    await contentDb.put({
      _id: "article:from-user",
      type: "article",
      schemaVersion: 1,
      title: "User's material",
    } as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);

    const docs = [makeSectionDoc("section:seed-c", "Section C")];
    const files = await buildSeedFiles(docs);

    const outcome = await seedFromBundleIfNeeded(contentDb, systemDb, makeFilePort(), makeSeedPortFromFiles(files));
    expect(outcome).toEqual({ status: "skipped-not-empty" });

    await expect(contentDb.get("section:seed-c")).rejects.toMatchObject({ status: 404 });
    const kept = await contentDb.get("article:from-user");
    expect((kept as unknown as { title: string }).title).toBe("User's material");

    const marker = (await systemDb.get(SEED_STATE_ID)) as unknown as SeedState;
    expect(marker.status).toBe("skipped-not-empty");
  });

  it("a corrupted/missing part resource -> status 'failed', marker written, the error is NOT rethrown outward", async () => {
    const files = new Map<string, Uint8Array>();
    const header = buildDumpHeader(1);
    files.set(
      SEED_MANIFEST_NAME,
      encodeManifest(buildManifest(header, 1, [{ file: "bundle.part001.json.gz", docCount: 1 }])),
    );

    const outcome = await seedFromBundleIfNeeded(contentDb, systemDb, makeFilePort(), makeSeedPortFromFiles(files));
    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.error).toContain("bundle.part001.json.gz");
    }

    const marker = (await systemDb.get(SEED_STATE_ID)) as unknown as SeedState;
    expect(marker.status).toBe("failed");
    expect(marker.error).toBeTruthy();

    const info = await contentDb.info();
    expect(info.doc_count).toBe(0);
  });

  it("a seed interrupted midway finishes on the next launch instead of passing itself off as someone's data", async () => {
    const manifestBytes = new Uint8Array(readFileSync(join(SEED_FIXTURE_DIR, "bundle.manifest.json")));
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as {
      parts: Array<{ file: string; docCount: number }>;
      totalDocCount: number;
    };
    const files = new Map<string, Uint8Array>();
    files.set(SEED_MANIFEST_NAME, manifestBytes);
    for (const part of manifest.parts) {
      files.set(part.file, new Uint8Array(readFileSync(join(SEED_FIXTURE_DIR, part.file))));
    }

    await systemDb.put({
      _id: SEED_STATE_ID,
      type: "seedstate",
      schemaVersion: SCHEMA_VERSION,
      status: "in-progress",
      bundleCreatedAt: null,
      bundleDocCount: manifest.totalDocCount,
      seededAt: new Date().toISOString(),
      error: null,
    } as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);
    const firstPart = JSON.parse(new TextDecoder().decode(await gunzipBytes(files.get(manifest.parts[0].file)!)));
    for (const doc of firstPart.docs) {
      await contentDb.put({ ...doc, _rev: undefined });
    }
    const beforeResume = await contentDb.allDocs();
    expect(beforeResume.rows.filter((r) => !r.id.startsWith("_design/")).length).toBeLessThan(
      manifest.totalDocCount,
    );

    const outcome = await seedFromBundleIfNeeded(contentDb, systemDb, makeFilePort(), makeSeedPortFromFiles(files));

    expect(outcome.status).toBe("seeded");
    const afterResume = await contentDb.allDocs();
    expect(afterResume.rows.filter((r) => !r.id.startsWith("_design/")).length).toBe(manifest.totalDocCount);
    await expect(contentDb.get("article:test-seed__a")).resolves.toBeTruthy();
    const state = (await systemDb.get(SEED_STATE_ID)) as unknown as SeedState;
    expect(state.status).toBe("seeded");
  });

  it("an inaccessible backups folder does not cancel seeding — there is nothing to save on first launch", async () => {
    const failingFilePort: FilePort = {
      ...makeFilePort(),
      async writeDump(): Promise<void> {
        throw new Error("EACCES: no write permission for C:\\Program Files\\Aurora\\backups");
      },
    };

    const manifestBytes = new Uint8Array(readFileSync(join(SEED_FIXTURE_DIR, "bundle.manifest.json")));
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as {
      parts: Array<{ file: string; docCount: number }>;
      totalDocCount: number;
    };
    const files = new Map<string, Uint8Array>();
    files.set(SEED_MANIFEST_NAME, manifestBytes);
    for (const part of manifest.parts) {
      files.set(part.file, new Uint8Array(readFileSync(join(SEED_FIXTURE_DIR, part.file))));
    }

    const outcome = await seedFromBundleIfNeeded(
      contentDb,
      systemDb,
      failingFilePort,
      makeSeedPortFromFiles(files),
    );

    expect(outcome).toEqual({ status: "seeded", docCount: manifest.totalDocCount });
    const section = (await contentDb.get("section:test-seed")) as unknown as { title: string };
    expect(section.title).toBe("Seed test section");
  });

  it("a REAL resource from app/src-tauri/seed/ (built by scripts/export_seed.py from the test fixture) merges as is", async () => {
    const seedDir = SEED_FIXTURE_DIR;
    const manifestBytes = new Uint8Array(readFileSync(join(seedDir, "bundle.manifest.json")));
    const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as {
      parts: Array<{ file: string; docCount: number }>;
      totalDocCount: number;
    };

    const files = new Map<string, Uint8Array>();
    files.set(SEED_MANIFEST_NAME, manifestBytes);
    for (const part of manifest.parts) {
      files.set(part.file, new Uint8Array(readFileSync(join(seedDir, part.file))));
    }

    const outcome = await seedFromBundleIfNeeded(contentDb, systemDb, makeFilePort(), makeSeedPortFromFiles(files));
    expect(outcome).toEqual({ status: "seeded", docCount: manifest.totalDocCount });

    const section = (await contentDb.get("section:test-seed")) as unknown as { title: string };
    expect(section.title).toBe("Seed test section");
    const article = (await contentDb.get("article:test-seed__a")) as unknown as { title: string };
    expect(article.title).toBe("Seed test article");

    const attachment = (await contentDb.getAttachment("article:test-seed__a", "img-1")) as Buffer | Blob;
    const attachmentBytes = Buffer.isBuffer(attachment)
      ? attachment
      : attachment instanceof Uint8Array
        ? Buffer.from(attachment)
        : Buffer.from(await (attachment as Blob).arrayBuffer());
    expect(attachmentBytes.length).toBeGreaterThan(0);
    expect(attachmentBytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });
});

describe("bundle.manifest.json in app/src-tauri/seed — the DumpManifest shape", () => {
  it("matches the shape of dumpFormat.ts: DumpManifest", () => {
    const seedDir = SEED_FIXTURE_DIR;
    const manifest = JSON.parse(readFileSync(join(seedDir, "bundle.manifest.json"), "utf-8"));
    expect(typeof manifest.dumpFormatVersion).toBe("number");
    expect(typeof manifest.schemaVersion).toBe("number");
    expect(typeof manifest.totalDocCount).toBe("number");
    expect(Array.isArray(manifest.parts)).toBe(true);
    for (const part of manifest.parts) {
      expect(typeof part.file).toBe("string");
      expect(typeof part.docCount).toBe("number");
    }
  });

  it("gunzipBytes reads every part; the docCount total matches totalDocCount", async () => {
    const seedDir = SEED_FIXTURE_DIR;
    const manifest = JSON.parse(readFileSync(join(seedDir, "bundle.manifest.json"), "utf-8"));
    let total = 0;
    for (const part of manifest.parts) {
      const gz = new Uint8Array(readFileSync(join(seedDir, part.file)));
      const raw = await gunzipBytes(gz);
      const decoded = JSON.parse(new TextDecoder().decode(raw));
      expect(decoded.docs.length).toBe(part.docCount);
      total += decoded.docs.length;
    }
    expect(total).toBe(manifest.totalDocCount);
  });
});
