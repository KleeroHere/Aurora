import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import { createContentDb, createSystemDb } from "./db";
import { createPlaceholderPdf, uint8ArrayToBase64 } from "./binary";
import { buildMigratedMaterialId } from "./slug";
import {
  createFileMaterial,
  downloadMaterialOriginal,
  getChangeLog,
  getMaterialById,
  getMaterialPdfUrl,
  getMaterialsBySection,
  initRepository,
  pickLocalFile,
  searchMaterials,
  shutdownRepository,
  updateMaterial,
} from "./repository";
import type { FilePort } from "./filePort";
import type { Presentation, Section } from "./types";

const PDF = createPlaceholderPdf("Session survey form");
const DOCX = new TextEncoder().encode("PK pretend docx");

let contentDb: PouchDB.Database;
let systemDb: PouchDB.Database;

function makeSectionDoc(id: string, title: string): Section {
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
    primaryTag: "program",
    legacy: { sourcePaths: [] },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function createFakePort(): FilePort & {
  written: Array<{ location: unknown; data: Uint8Array; mimeType?: string }>;
  next: { name: string; bytes: Uint8Array } | null;
  lastPickFilter: unknown;
} {
  const port = {
    written: [] as Array<{ location: unknown; data: Uint8Array; mimeType?: string }>,
    next: null as { name: string; bytes: Uint8Array } | null,
    lastPickFilter: undefined as unknown,
    async writeDump(location: unknown, data: Uint8Array, mimeType?: string) {
      port.written.push({ location, data, mimeType });
    },
    async readDump(handle: unknown) {
      return (handle as { bytes: Uint8Array }).bytes;
    },
    async pickFile(filter?: unknown) {
      port.lastPickFilter = filter;
      return port.next;
    },
    async pickFiles() {
      return null;
    },
    async pickSaveLocation(suggestedName: string) {
      return `saved/${suggestedName}`;
    },
    async getAutoBackupLocation(suggestedName: string) {
      return `backups/${suggestedName}`;
    },
    fileName(handle: unknown) {
      return (handle as { name: string }).name;
    },
  };
  return port as unknown as ReturnType<typeof createFakePort>;
}

let port: ReturnType<typeof createFakePort>;

beforeEach(async () => {
  contentDb = createContentDb(NodePouchDB, createNodeDbOptions());
  systemDb = createSystemDb(NodePouchDB, createNodeDbOptions());
  port = createFakePort();
  await initRepository({ contentDb, systemDb, seed: false, filePort: port });
  await contentDb.put(makeSectionDoc("section:programma", "Program"));
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
});

afterEach(async () => {
  vi.restoreAllMocks();
  await shutdownRepository();
  await contentDb.destroy().catch(() => undefined);
  await systemDb.destroy().catch(() => undefined);
});

async function bytesOf(value: unknown): Promise<Uint8Array> {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  return new Uint8Array(await (value as Blob).arrayBuffer());
}

async function putMigratedPresentation(): Promise<string> {
  const _id = buildMigratedMaterialId("presentation", "programma", "migrirovannaya");
  await contentDb.put({
    _id,
    type: "presentation",
    schemaVersion: 1,
    title: "Migrated presentation",
    sectionId: "section:programma",
    tags: ["program"],
    card: { color: "neutral", cover: { attachment: "cover" } },
    order: 0,
    createdBy: "migration",
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedBy: "migration",
    updatedAt: "2026-08-02T00:00:00.000Z",
    legacy: { sourcePath: "corpus/x.pptx", sourceName: "x.pptx", migratedAt: "2026-08-02T00:00:00.000Z" },
    file: {
      original: { attachment: "original", name: "x.pptx", ext: "pptx", size: DOCX.length },
      pdf: { attachment: "pdf", size: PDF.length },
    },
    plainText: "Migrated presentation",
    excerpt: null,
    _attachments: {
      original: { content_type: "application/vnd.ms-powerpoint", data: uint8ArrayToBase64(DOCX) },
      pdf: { content_type: "application/pdf", data: uint8ArrayToBase64(PDF) },
      cover: { content_type: "image/png", data: uint8ArrayToBase64(new Uint8Array([0x89, 0x50])) },
    },
  } as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);
  return _id;
}

describe("path 1: the person brought only a PDF", () => {
  async function create() {
    return createFileMaterial({
      type: "form",
      sectionId: "section:programma",
      title: "Session survey",
      tags: ["program", "surveys"],
      pdf: { name: "Session survey.pdf", bytes: PDF },
      coverPng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      createdBy: "alex",
      authorId: "user:01J",
    });
  }

  it("opens: the viewer gets exactly the bytes that were brought in", async () => {
    const material = await create();
    const captured: unknown[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      captured.push(blob);
      return "blob:test/1";
    });

    await getMaterialPdfUrl(material._id);

    expect(await bytesOf(captured[0])).toEqual(PDF);
  });

  it("downloads: under its own name, even though the single attachment is called \"pdf\"", async () => {
    const material = await create();

    const ok = await downloadMaterialOriginal(material._id);

    expect(ok).toBe(true);
    expect(await bytesOf(port.written[0].data)).toEqual(PDF);
    expect(port.written[0].location).toBe("saved/Session survey.pdf");
  });

  it("searchable: by title, like any other material", async () => {
    const material = await create();
    const hits = await searchMaterials("survey");
    expect(hits.map((h) => h.summary._id)).toContain(material._id);
  });

  it("cover in place - indistinguishable from a migrated one in the card grid", async () => {
    const material = await create();
    expect(material.card.cover).toEqual({ attachment: "cover" });
  });

  it("section tags preserved: otherwise the tag filter will not show it", async () => {
    const material = await create();
    expect(material.tags).toContain("program");
  });

  it("PDF bytes are not duplicated as a second attachment", async () => {
    const material = await create();
    const doc = await contentDb.get(material._id, { attachments: false });
    expect(Object.keys((doc as { _attachments: object })._attachments).sort()).toEqual(["cover", "pdf"]);
  });

  it("creation landed in the change log", async () => {
    const material = await create();
    const log = await getChangeLog();
    const entry = log.find((c) => c.targetId === material._id);
    expect(entry?.op).toBe("create");
    expect(entry?.userId).toBe("user:01J");
  });
});

describe("path 2: the person brought the source file and a PDF", () => {
  async function create() {
    return createFileMaterial({
      type: "presentation",
      sectionId: "section:programma",
      title: "Session presentation",
      tags: ["program"],
      pdf: { name: "Presentation.pdf", bytes: PDF },
      original: { name: "Presentation.pptx", bytes: DOCX },
      createdBy: "alex",
    });
  }

  it("opens: the PDF is shown, not the source file", async () => {
    const material = await create();
    const captured: unknown[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      captured.push(blob);
      return "blob:test/1";
    });

    await getMaterialPdfUrl(material._id);

    expect(await bytesOf(captured[0])).toEqual(PDF);
  });

  it("downloads: the source file under its original name, not the converted copy", async () => {
    const material = await create();

    await downloadMaterialOriginal(material._id);

    expect(await bytesOf(port.written[0].data)).toEqual(DOCX);
    expect(port.written[0].location).toBe("saved/Presentation.pptx");
  });

  it("searchable", async () => {
    const material = await create();
    const hits = await searchMaterials("presentation");
    expect(hits.map((h) => h.summary._id)).toContain(material._id);
  });

  it("source extension lands on the card - the type icon is drawn from it", async () => {
    const material = await create();
    const list = await getMaterialsBySection("section:programma");
    expect(list.find((m) => m._id === material._id)?.file).toEqual({ ext: "pptx", size: DOCX.length });
  });
});

describe("indistinguishable from a migrated material", () => {
  it("document field set matches the migrated one exactly", async () => {
    const migratedId = await putMigratedPresentation();
    const created = await createFileMaterial({
      type: "presentation",
      sectionId: "section:programma",
      title: "Created presentation",
      tags: ["program"],
      pdf: { name: "Created.pdf", bytes: PDF },
      original: { name: "Created.pptx", bytes: DOCX },
      coverPng: new Uint8Array([0x89, 0x50]),
      createdBy: "alex",
    });

    const migrated = (await getMaterialById(migratedId)) as Presentation;
    const fresh = (await getMaterialById(created._id)) as Presentation;

    const shape = (doc: Presentation) =>
      Object.keys(doc)
        .filter((key) => !key.startsWith("_"))
        .sort();
    expect(shape(fresh)).toEqual(shape(migrated));
    expect(Object.keys(fresh.file).sort()).toEqual(Object.keys(migrated.file).sort());
    expect(Object.keys(fresh.file.original).sort()).toEqual(Object.keys(migrated.file.original).sort());
  });

  it("both open, download, and are found the same way", async () => {
    const migratedId = await putMigratedPresentation();
    const created = await createFileMaterial({
      type: "presentation",
      sectionId: "section:programma",
      title: "Created presentation",
      tags: ["program"],
      pdf: { name: "Created.pdf", bytes: PDF },
      original: { name: "Created.pptx", bytes: DOCX },
      createdBy: "alex",
    });

    for (const id of [migratedId, created._id]) {
      await expect(getMaterialPdfUrl(id)).resolves.toMatch(/^blob:/);
      await expect(downloadMaterialOriginal(id)).resolves.toBe(true);
    }
    const hits = await searchMaterials("presentation");
    expect(hits.map((h) => h.summary._id)).toEqual(expect.arrayContaining([migratedId, created._id]));
  });
});

describe("picking a file from disk", () => {
  it("the dialog receives a filter - otherwise PDFs are invisible in the file explorer", async () => {
    port.next = { name: "Survey.pdf", bytes: PDF };

    const picked = await pickLocalFile({ label: "PDF", extensions: ["pdf"] }, "document.pdf");

    expect(picked).toEqual({ name: "Survey.pdf", bytes: PDF });
    expect(port.lastPickFilter).toEqual({ label: "PDF", extensions: ["pdf"] });
  });

  it("cancelling the dialog yields null, not an error", async () => {
    port.next = null;
    await expect(pickLocalFile({ label: "PDF", extensions: ["pdf"] }, "document.pdf")).resolves.toBeNull();
  });
});

describe("full-text search over a file material", () => {
  const MIDDLE = "the migration requires careful coordination of the rollout schedule";

  async function createWithText() {
    return createFileMaterial({
      type: "presentation",
      sectionId: "section:programma",
      title: "Session seven",
      tags: ["program"],
      pdf: { name: "Session.pdf", bytes: PDF },
      plainText: `First page about the stages. ${MIDDLE}. Last page about the results.`,
      createdBy: "alex",
    });
  }

  it("a phrase from the middle of the document finds the material even though the title lacks it", async () => {
    const material = await createWithText();

    const hits = await searchMaterials("migration rollout");

    expect(hits.map((h) => h.summary._id)).toContain(material._id);
  });

  it("renaming does not drop the full text - the phrase is still found afterwards", async () => {
    const material = await createWithText();

    await updateMaterial(material._id, { title: "Session seven (edited)", updatedBy: "alex" });

    const hits = await searchMaterials("migration");
    expect(hits.map((h) => h.summary._id)).toContain(material._id);
    const reloaded = (await getMaterialById(material._id)) as Presentation;
    expect(reloaded.plainText).toContain(MIDDLE);
  });

  it("a material WITHOUT a text layer renames correctly: the old name no longer matches", async () => {
    const material = await createFileMaterial({
      type: "form",
      sectionId: "section:programma",
      title: "Badges",
      pdf: { name: "Badges.pdf", bytes: PDF },
      createdBy: "alex",
    });
    expect((material as unknown as { plainText: string }).plainText).toBe("Badges");

    await updateMaterial(material._id, { title: "Participant cards", updatedBy: "alex" });

    const reloaded = (await getMaterialById(material._id)) as Presentation;
    expect(reloaded.plainText).toBe("Participant cards");
  });
});
