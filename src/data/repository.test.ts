import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import { createPlaceholderPdf, uint8ArrayToBase64 } from "./binary";
import { createContentDb, createSystemDb } from "./db";
import { seedContentIfNeeded } from "./seed";
import { buildOutputData, eBlockHeader, eBlockParagraph } from "./seedData";
import { buildMigratedMaterialId } from "./slug";
import { computeArticleDerivedFields } from "./derived";
import { SCHEMA_VERSION } from "./types";
import {
  addMaterialAttachment,
  createMaterial,
  createSection,
  deleteMaterial,
  downloadMaterialAttachment,
  downloadMaterialOriginal,
  exportChangeLogToFile,
  exportDatabase,
  exportDiagnosticsLog,
  getAppLog,
  getChangeLog,
  getMaterialById,
  getMaterialPdfUrl,
  getMaterialsBySection,
  getRelatedMaterials,
  getSectionById,
  getSections,
  importDatabase,
  initRepository,
  logAppEvent,
  restoreMaterial,
  searchMaterials,
  setSectionHidden,
  shutdownRepository,
  subscribe,
  updateMaterial,
} from "./repository";
import type { Article, Section } from "./types";
import type { FilePort, SaveFilter } from "./filePort";

let contentDb: PouchDB.Database;
let systemDb: PouchDB.Database;

beforeEach(() => {
  contentDb = createContentDb(NodePouchDB, createNodeDbOptions());
  systemDb = createSystemDb(NodePouchDB, createNodeDbOptions());
});

afterEach(async () => {
  await shutdownRepository();
  await contentDb.destroy().catch(() => undefined);
  await systemDb.destroy().catch(() => undefined);
});

async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor: the condition was not met in the allotted time");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

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
    primaryTag: "test",
    legacy: { sourcePaths: [] },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("seedContentIfNeeded", () => {
  it("creates 5 sections and 12 materials and is idempotent on a repeat run", async () => {
    const first = await seedContentIfNeeded(contentDb);
    expect(first.sectionsCreated).toBe(10);
    expect(first.materialsCreated).toBe(44);

    const second = await seedContentIfNeeded(contentDb);
    expect(second.sectionsCreated).toBe(0);
    expect(second.materialsCreated).toBe(0);

    const info = await contentDb.info();
    expect(info.doc_count).toBeGreaterThanOrEqual(54); // 10 + 44 (+ 2 index ddocs if already created)
  });

  it("includes one nested section via parentId", async () => {
    await seedContentIfNeeded(contentDb);
    const nested = await contentDb.get<Section>("section:night-shift");
    expect(nested.parentId).toBe("section:programme");
  });
});

describe("repository: material CRUD", () => {
  beforeEach(async () => {
    await initRepository({ contentDb, systemDb, seed: false });
    await contentDb.put(makeSectionDoc("section:test", "Test section"));
  });

  it("creates an article with recomputed derived fields", async () => {
    const created = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Test article",
      body: buildOutputData([eBlockHeader("Heading"), eBlockParagraph("Article text for the search check.")]),
      createdBy: "test",
    });

    expect(created.type).toBe("article");
    if (created.type !== "article") throw new Error("expected article");
    expect(created.plainText).toContain("Article text for the search check");
    expect(created.excerpt.length).toBeGreaterThan(0);
    expect(created.readingTime).toBeGreaterThanOrEqual(1);
  });

  it("reads a material by id and by section", async () => {
    const created = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Readable article",
      body: buildOutputData([eBlockParagraph("Contents.")]),
      createdBy: "test",
    });

    const byId = await getMaterialById(created._id);
    expect(byId?.title).toBe("Readable article");

    const bySection = await getMaterialsBySection("section:test");
    expect(bySection.map((m) => m._id)).toContain(created._id);
  });

  it("a section of 30 materials returns all 30, not trimmed to 25 (2026-08-01 finding: pouchdb-find injects limit:25 unless you pass your own)", async () => {
    for (let i = 0; i < 30; i += 1) {
      await createMaterial({
        type: "article",
        sectionId: "section:test",
        title: `Material ${i}`,
        body: buildOutputData([eBlockParagraph("Text.")]),
        createdBy: "test",
      });
    }

    const bySection = await getMaterialsBySection("section:test");
    expect(bySection.length).toBeGreaterThanOrEqual(30);
  });

  it("updates a material and atomically recomputes the derived fields (section 9 invariant)", async () => {
    const created = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Article before the edit",
      body: buildOutputData([eBlockParagraph("Old text of version one.")]),
      createdBy: "test",
    });

    const updated = await updateMaterial(created._id, {
      body: buildOutputData([eBlockParagraph("Completely new text of version two.")]),
      updatedBy: "test",
    });

    if (updated.type !== "article") throw new Error("expected article");
    expect(updated.plainText).toContain("version two");
    expect(updated.plainText).not.toContain("version one");
    expect(updated.excerpt).toContain("new text");
  });

  it("deletes a material", async () => {
    const created = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Article to delete",
      body: buildOutputData([eBlockParagraph("Text.")]),
      createdBy: "test",
    });

    await deleteMaterial(created._id, "test");
    const afterDelete = await getMaterialById(created._id);
    expect(afterDelete).toBeUndefined();
  });

  it(
    "K.1: add an image, save, delete the block, save — after the second save " +
      "the orphaned attachment is gone from _attachments",
    async () => {
      const created = await createMaterial({
        type: "article",
        sectionId: "section:test",
        title: "Article with a picture",
        body: buildOutputData([eBlockParagraph("Text.")]),
        createdBy: "test",
      });

      await addMaterialAttachment(created._id, "img-orphan", "image/png", uint8ArrayToBase64(new Uint8Array([1, 2, 3])));
      await updateMaterial(created._id, {
        body: buildOutputData([
          eBlockParagraph("Text."),
          { type: "image", data: { file: { key: "img-orphan" }, caption: "" } },
        ]),
        updatedBy: "test",
      });

      const withImage = await contentDb.get(created._id, { attachments: false });
      expect(Object.keys((withImage as unknown as { _attachments?: Record<string, unknown> })._attachments ?? {})).toContain(
        "img-orphan",
      );

      await updateMaterial(created._id, {
        body: buildOutputData([eBlockParagraph("Text without the picture.")]),
        updatedBy: "test",
      });

      const afterCleanup = await contentDb.get(created._id, { attachments: false });
      expect(
        Object.keys((afterCleanup as unknown as { _attachments?: Record<string, unknown> })._attachments ?? {}),
      ).not.toContain("img-orphan");
    },
  );

  it("K.1: save a presentation twice — the original, the PDF and the cover stay put (not orphans)", async () => {
    const created = await createMaterial({
      type: "presentation",
      sectionId: "section:test",
      title: "Presentation",
      file: {
        original: { attachment: "original", name: "Presentation.pptx", ext: "pptx", size: 3 },
        pdf: { attachment: "pdf", size: 3 },
      },
      attachments: {
        original: { content_type: "application/octet-stream", data: uint8ArrayToBase64(new Uint8Array([1])) },
        pdf: { content_type: "application/pdf", data: uint8ArrayToBase64(new Uint8Array([2])) },
        cover: { content_type: "image/png", data: uint8ArrayToBase64(new Uint8Array([3])) },
      },
      createdBy: "test",
    });

    await updateMaterial(created._id, { title: "Presentation (edit 1)", updatedBy: "test" });
    await updateMaterial(created._id, { title: "Presentation (edit 2)", updatedBy: "test" });

    const finalDoc = await contentDb.get(created._id, { attachments: false });
    const keys = Object.keys((finalDoc as unknown as { _attachments?: Record<string, unknown> })._attachments ?? {});
    expect(keys.sort()).toEqual(["cover", "original", "pdf"]);
  });

  it("writes a change-log entry (change) on create/update/delete", async () => {
    const created = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Material for the log",
      body: buildOutputData([eBlockParagraph("Text.")]),
      createdBy: "test-user",
    });
    await updateMaterial(created._id, { title: "Material for the log (edited)", updatedBy: "test-user" });
    await deleteMaterial(created._id, "test-user");

    const changes = await systemDb.allDocs({ include_docs: true, startkey: "change:", endkey: "change:￿" });
    const ops = changes.rows.map((r) => (r.doc as unknown as { op: string }).op);
    expect(ops).toEqual(["create", "update", "delete"]);
  });
});

describe("repository: P9 — section move, soft delete/restore, related materials", () => {
  beforeEach(async () => {
    await initRepository({ contentDb, systemDb, seed: false });
    await contentDb.put({ ...makeSectionDoc("section:a", "Section A"), primaryTag: "section-a" });
    await contentDb.put({ ...makeSectionDoc("section:b", "Section B"), primaryTag: "section-b" });
  });

  it("moving to another section does NOT change the _id (schema section 2.3 — the id is the birthplace, not the current location)", async () => {
    const created = await createMaterial({
      type: "article",
      sectionId: "section:a",
      title: "Movable article",
      body: buildOutputData([eBlockParagraph("Text.")]),
      tags: ["section-a", "#crisis"],
      createdBy: "test",
    });
    const originalId = created._id;

    const moved = await updateMaterial(created._id, { sectionId: "section:b", updatedBy: "test" });

    expect(moved._id).toBe(originalId);
    expect(moved.sectionId).toBe("section:b");
    expect((await getMaterialById(originalId))?._id).toBe(originalId);
  });

  it("moving to another section recomputes the primaryTag automatically, user tags are kept", async () => {
    const created = await createMaterial({
      type: "article",
      sectionId: "section:a",
      title: "Article with tags",
      body: buildOutputData([eBlockParagraph("Text.")]),
      tags: ["section-a", "#crisis"],
      createdBy: "test",
    });

    const moved = await updateMaterial(created._id, { sectionId: "section:b", updatedBy: "test" });

    expect(moved.tags).not.toContain("section-a");
    expect(moved.tags).toContain("section-b");
    expect(moved.tags).toContain("#crisis");
  });

  it("soft delete: the material disappears from the UI, restoreMaterial brings it back with the same _id and attachments", async () => {
    const created = await createMaterial({
      type: "article",
      sectionId: "section:a",
      title: "Article deleted with undo",
      body: buildOutputData([eBlockParagraph("Text.")]),
      createdBy: "test",
    });
    await addMaterialAttachment(created._id, "img-1", "image/png", uint8ArrayToBase64(new Uint8Array([9, 9])));

    const snapshot = await deleteMaterial(created._id, "test");
    expect(snapshot.material.title).toBe("Article deleted with undo");
    expect(await getMaterialById(created._id)).toBeUndefined();

    const restored = await restoreMaterial(snapshot, "test");
    expect(restored._id).toBe(created._id);
    expect(restored.title).toBe("Article deleted with undo");

    const afterRestore = await contentDb.get(created._id, { attachments: false });
    expect(
      Object.keys((afterRestore as unknown as { _attachments?: Record<string, unknown> })._attachments ?? {}),
    ).toContain("img-1");
  });

  it("getRelatedMaterials: materials sharing a tag, without the material itself and without unrelated ones", async () => {
    const a = await createMaterial({
      type: "article",
      sectionId: "section:a",
      title: "Material A",
      body: buildOutputData([eBlockParagraph("Text.")]),
      tags: ["#crisis"],
      createdBy: "test",
    });
    const b = await createMaterial({
      type: "article",
      sectionId: "section:a",
      title: "Material B",
      body: buildOutputData([eBlockParagraph("Text.")]),
      tags: ["#crisis"],
      createdBy: "test",
    });
    const c = await createMaterial({
      type: "article",
      sectionId: "section:a",
      title: "Material C (no shared tags)",
      body: buildOutputData([eBlockParagraph("Text.")]),
      tags: ["#chores"],
      createdBy: "test",
    });

    await waitFor(async () => (await getRelatedMaterials(a._id, ["#crisis"])).length > 0);
    const related = await getRelatedMaterials(a._id, ["#crisis"]);

    expect(related.map((m) => m._id)).toContain(b._id);
    expect(related.map((m) => m._id)).not.toContain(a._id);
    expect(related.map((m) => m._id)).not.toContain(c._id);
  });
});

describe("repository: search and reactivity", () => {
  beforeEach(async () => {
    await initRepository({ contentDb, systemDb, seed: false });
    await contentDb.put(makeSectionDoc("section:test", "Test section"));
  });

  it("finds a material by title and by plainText (live search)", async () => {
    await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Unique heading Zanzibar",
      body: buildOutputData([eBlockParagraph("The text inside mentions the word flamingo.")]),
      createdBy: "test",
    });

    await waitFor(async () => (await searchMaterials("Zanzibar")).length > 0);
    const byTitle = await searchMaterials("Zanzibar");
    expect(byTitle.length).toBe(1);

    const byBody = await searchMaterials("flamingo");
    expect(byBody.length).toBe(1);
  });

  it("reacts to changes via subscribe on create/update/delete", async () => {
    const events: string[] = [];
    const unsubscribe = subscribe((event) => {
      if (event.docType !== "section") events.push(event.op);
    });

    const created = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Reactive article",
      body: buildOutputData([eBlockParagraph("Text.")]),
      createdBy: "test",
    });
    await waitFor(() => events.includes("created"));

    await updateMaterial(created._id, { title: "Reactive article (edited)", updatedBy: "test" });
    await waitFor(() => events.includes("updated"));

    await deleteMaterial(created._id, "test");
    await waitFor(() => events.includes("deleted"));

    unsubscribe();
    expect(events).toEqual(["created", "updated", "deleted"]);
  });

  it("a deleted material disappears from search", async () => {
    const created = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Material to vanish from search",
      body: buildOutputData([eBlockParagraph("Text.")]),
      createdBy: "test",
    });
    await waitFor(async () => (await searchMaterials("vanish")).length > 0);
    expect((await searchMaterials("vanish")).length).toBe(1);

    await deleteMaterial(created._id, "test");
    await waitFor(async () => (await searchMaterials("vanish")).length === 0);
  });
});

describe("repository: sections", () => {
  it("returns sections sorted by order", async () => {
    await initRepository({ contentDb, systemDb, seed: true });
    const sections = await getSections();
    expect(sections.length).toBe(10);
    const orders = sections.filter((s) => s.parentId === null).map((s) => s.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("getSectionById finds a section by id", async () => {
    await initRepository({ contentDb, systemDb, seed: true });
    const section = await getSectionById("section:intake");
    expect(section?.title).toBe("Intake and first days");
  });
});

describe("repository: createSection (P12, task 3)", () => {
  beforeEach(async () => {
    await initRepository({ contentDb, systemDb, seed: false });
  });

  it("creates a top-level section with a slug derived from the title", async () => {
    const section = await createSection({
      title: "Release notes",
      description: "Materials about releases",
      macroCategory: "methods",
      order: 5,
    });

    expect(section._id).toBe("section:release-notes");
    expect(section.slug).toBe("release-notes");
    expect(section.parentId).toBeNull();
    expect(section.macroCategory).toBe("methods");
    expect(section.order).toBe(5);
    expect(section.hidden).toBeUndefined();
    expect(section.legacy.sourcePaths).toEqual([]);

    const fromDb = await getSectionById("section:release-notes");
    expect(fromDb?.title).toBe("Release notes");
  });

  it("a slug collision is an explicit error, not a silent overwrite", async () => {
    await createSection({ title: "Journals", description: "", macroCategory: "methods", order: 1 });

    await expect(
      createSection({ title: "Journals", description: "another", macroCategory: "formal", order: 2 }),
    ).rejects.toThrow();

    const sections = await getSections();
    expect(sections.filter((s) => s.slug === "journals")).toHaveLength(1);
  });
});

describe("repository: setSectionHidden (P12, task 3.5)", () => {
  beforeEach(async () => {
    await initRepository({ contentDb, systemDb, seed: false });
  });

  it("hides and brings back a section without deleting the document", async () => {
    const created = await createSection({
      title: "Mistaken section",
      description: "",
      macroCategory: "methods",
      order: 1,
    });
    expect(created.hidden).toBeUndefined();

    const hidden = await setSectionHidden(created._id, true);
    expect(hidden.hidden).toBe(true);
    expect(hidden._id).toBe(created._id);

    const stillThere = await getSectionById(created._id);
    expect(stillThere?.hidden).toBe(true);

    const shown = await setSectionHidden(created._id, false);
    expect(shown.hidden).toBe(false);
  });

  it("notifies subscribers about a section change, not only about materials", async () => {
    const events: { op: string; docType?: string; id: string }[] = [];
    const unsubscribe = subscribe((event) => events.push({ op: event.op, docType: event.docType, id: event.id }));

    const created = await createSection({
      title: "Section for events",
      description: "",
      macroCategory: "methods",
      order: 2,
    });
    await waitFor(() => events.some((e) => e.docType === "section" && e.id === created._id));

    events.length = 0;
    await setSectionHidden(created._id, true);
    await waitFor(() => events.some((e) => e.docType === "section" && e.id === created._id));

    unsubscribe();
    const sectionEvents = events.filter((e) => e.docType === "section");
    expect(sectionEvents.length).toBeGreaterThan(0);
    expect(sectionEvents[0].op).toBe("updated");
  });
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

function makeArticleDoc(id: string, title: string, sectionId: string, text: string): Article {
  const body = buildOutputData([eBlockParagraph(text)]);
  const derivedFields = computeArticleDerivedFields(body);
  return {
    _id: id,
    type: "article",
    schemaVersion: SCHEMA_VERSION,
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
    body,
    ...derivedFields,
  };
}

describe("repository: id generation — collisions and ULID (schema section 2)", () => {
  beforeEach(async () => {
    await initRepository({ contentDb, systemDb, seed: false });
    await contentDb.put(makeSectionDoc("section:test", "Test section"));
  });

  it("createMaterial with the same title in one section yields DIFFERENT ids (shortid uniqueness at the repository level, not just slug.ts)", async () => {
    const first = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Identical title",
      body: buildOutputData([eBlockParagraph("Version one.")]),
      createdBy: "test",
    });
    const second = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Identical title",
      body: buildOutputData([eBlockParagraph("Version two.")]),
      createdBy: "test",
    });
    expect(first._id).not.toBe(second._id);
    expect(await getMaterialById(first._id)).toBeDefined();
    expect(await getMaterialById(second._id)).toBeDefined();
  });

  it(
    "FINDING: a collision of 'migrated' ids (same type+section+nameSlug from two DIFFERENT sources) " +
      "results in a PouchDB write conflict, not an automatic -<hash6> suffix (schema section 2.2 " +
      "is not implemented at runtime — see reports/night-tests-findings.md)",
    async () => {
      const collidingId = buildMigratedMaterialId("article", "test", "step-1");
      const docA = makeArticleDoc(collidingId, "Step 1", "section:test", "Text of the first file.");
      const docB = makeArticleDoc(collidingId, "Step-1", "section:test", "Text of the SECOND, different file.");

      await contentDb.put(docA);
      await expect(contentDb.put(docB)).rejects.toMatchObject({ status: 409 });

      const stored = await getMaterialById(collidingId);
      expect(stored?.title).toBe("Step 1");
    },
  );

  it("change._id matches the format change:<26-character Crockford base32 ULID>", async () => {
    await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "For checking the change-log format",
      body: buildOutputData([eBlockParagraph("Text.")]),
      createdBy: "test",
    });
    const rows = await systemDb.allDocs({ startkey: "change:", endkey: "change:￿" });
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0].id).toMatch(/^change:[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it(
    "20 consecutive writes (faster than 1ms each) yield change documents in STRICTLY chronological " +
      "order when sorted by id (monotonic ULID, section 2.4 — a regression test for a bug found and " +
      "fixed in a previous session: a plain ulid() without monotonicFactory() does not guarantee this)",
    async () => {
      const created = await createMaterial({
        type: "article",
        sectionId: "section:test",
        title: "Material for a series of edits",
        body: buildOutputData([eBlockParagraph("v0")]),
        createdBy: "test",
      });

      const expectedOrder: string[] = ["create"];
      for (let i = 1; i <= 20; i++) {
        await updateMaterial(created._id, {
          body: buildOutputData([eBlockParagraph(`v${i}`)]),
          updatedBy: "test",
        });
        expectedOrder.push("update");
      }

      const rows = await systemDb.allDocs({
        include_docs: true,
        startkey: "change:",
        endkey: "change:￿",
      });
      const opsInIdOrder = rows.rows.map((r) => (r.doc as unknown as { op: string }).op);
      expect(opsInIdOrder).toEqual(expectedOrder);
    },
  );
});

describe("seedContentIfNeeded: idempotency (extended)", () => {
  it("three consecutive runs — creation only on the first, doc_count stops growing after the second", async () => {
    const first = await seedContentIfNeeded(contentDb);
    const infoAfterFirst = await contentDb.info();

    const second = await seedContentIfNeeded(contentDb);
    const infoAfterSecond = await contentDb.info();

    const third = await seedContentIfNeeded(contentDb);
    const infoAfterThird = await contentDb.info();

    expect(first).toEqual({ sectionsCreated: 10, materialsCreated: 44 });
    expect(second).toEqual({ sectionsCreated: 0, materialsCreated: 0 });
    expect(third).toEqual({ sectionsCreated: 0, materialsCreated: 0 });
    expect(infoAfterFirst.doc_count).toBe(54); // 10 sections + 44 materials, no Mango indexes in this test
    expect(infoAfterSecond.doc_count).toBe(infoAfterFirst.doc_count);
    expect(infoAfterThird.doc_count).toBe(infoAfterFirst.doc_count);
  });

  it("a repeat run does NOT touch the _rev of existing documents (the seed skips them, never rewrites)", async () => {
    await seedContentIfNeeded(contentDb);
    const before = await contentDb.get("section:intake");

    await seedContentIfNeeded(contentDb);
    const after = await contentDb.get("section:intake");

    expect(after._rev).toBe(before._rev);
  });

  it(
    'idempotency means "no duplicates by id", NOT "synchronize the content" — a manual edit of ' +
      "a seed document survives a repeat seed run (documented behavior, not a bug)",
    async () => {
      await seedContentIfNeeded(contentDb);
      const doc = await contentDb.get<Section>("section:intake");
      await contentDb.put({ ...doc, title: "Manually changed title" });

      await seedContentIfNeeded(contentDb);

      const after = await contentDb.get<Section>("section:intake");
      expect(after.title).toBe("Manually changed title");
    },
  );

  it("a document that HAPPENS to occupy a seed material's id BEFORE the seed run blocks the seed version (existence is checked by id only)", async () => {
    const clashId = "article:intake__the-intake-interview";
    await contentDb.put(
      makeArticleDoc(clashId, "A completely different document", "section:intake", "Has nothing to do with the seed."),
    );

    const result = await seedContentIfNeeded(contentDb);

    expect(result.sectionsCreated).toBe(10);
    expect(result.materialsCreated).toBe(43); // 44 - 1 (the id is already taken)

    const stored = await contentDb.get<Article>(clashId);
    expect(stored.title).toBe("A completely different document");
  });

  it(
    "seeding a database with an incomplete section set creates exactly the missing ones " +
      "(phase 4, §4.3 — it does not skip the whole job just because the database is not empty)",
    async () => {
      await contentDb.put(makeSectionDoc("section:intake", "Intake and first days"));
      await contentDb.put(makeSectionDoc("section:programme", "Daily programme"));
      await contentDb.put(makeSectionDoc("section:crisis", "Crisis situations"));
      const before = await contentDb.get("section:intake");

      const result = await seedContentIfNeeded(contentDb);

      expect(result.sectionsCreated).toBe(7);
      const created = await contentDb.get<Section>("section:night-shift");
      expect(created.title).toBe("Night shift");
      const records = await contentDb.get<Section>("section:records");
      expect(records.title).toBe("Journals and forms");

      const after = await contentDb.get("section:intake");
      expect(after._rev).toBe(before._rev);
    },
  );
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

describe("repository: material creation flow (task H)", () => {
  beforeEach(async () => {
    await initRepository({ contentDb, systemDb, seed: false });
    await contentDb.put(makeSectionDoc("section:test", "Test section"));
  });

  it("the document is created immediately, with an empty body, before any save from the editor", async () => {
    const created = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Draft",
      body: { time: Date.now(), blocks: [], version: "2.31.6" },
      createdBy: "editor-ui",
    });

    expect(created.type).toBe("article");
    const fromDb = await getMaterialById(created._id);
    expect(fromDb).toBeDefined();
    if (fromDb?.type !== "article") throw new Error("expected article");
    expect(fromDb.body.blocks).toEqual([]);
  });

  it(
    "inserting an attachment works for a just-created (not yet saved from the editor) material " +
      "— db.get used to return 404 for an unsaved article, now the document already exists",
    async () => {
      const created = await createMaterial({
        type: "article",
        sectionId: "section:test",
        title: "Draft with a picture",
        body: { time: Date.now(), blocks: [], version: "2.31.6" },
        createdBy: "editor-ui",
      });

      const png = uint8ArrayToBase64(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
      await addMaterialAttachment(created._id, "img-abc123", "image/png", png);

      const stored = await contentDb.get(created._id, { attachments: true, binary: true });
      expect(Object.keys(stored._attachments ?? {})).toContain("img-abc123");
    },
  );

  it("cancelling creation deletes the document together with its attachments (deleteMaterial, called by the UI on explicit cancel)", async () => {
    const created = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Draft to cancel",
      body: { time: Date.now(), blocks: [], version: "2.31.6" },
      createdBy: "editor-ui",
    });
    await addMaterialAttachment(created._id, "img-xyz", "image/png", uint8ArrayToBase64(new Uint8Array([1, 2, 3])));

    await deleteMaterial(created._id, "editor-ui");

    expect(await getMaterialById(created._id)).toBeUndefined();
    await expect(contentDb.get(created._id)).rejects.toMatchObject({ status: 404 });
  });

  it("a new material gets an order at the end of the section list", async () => {
    await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "First",
      body: { time: Date.now(), blocks: [], version: "2.31.6" },
      createdBy: "editor-ui",
    });
    const second = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Second",
      body: { time: Date.now(), blocks: [], version: "2.31.6" },
      createdBy: "editor-ui",
    });

    const list = await getMaterialsBySection("section:test");
    expect(list[list.length - 1]._id).toBe(second._id);
  });
});

describe("repository: exportDatabase/importDatabase without a filePort (task I)", () => {
  it("they require a filePort in initRepository — without it they throw a clear error instead of failing silently", async () => {
    await initRepository({ contentDb, systemDb, seed: false }); // filePort not passed
    await expect(exportDatabase()).rejects.toThrow(/filePort/);
    await expect(importDatabase()).rejects.toThrow(/filePort/);
  });
});

function createFakeFilePort(saveLocation: string | null = "chosen-location"): FilePort & {
  written: Array<{ location: unknown; data: Uint8Array; mimeType?: string }>;
  saveLocationCalls: Array<{ suggestedName: string; title: string; filter?: SaveFilter }>;
} {
  const written: Array<{ location: unknown; data: Uint8Array; mimeType?: string }> = [];
  const saveLocationCalls: Array<{ suggestedName: string; title: string; filter?: SaveFilter }> = [];
  return {
    written,
    saveLocationCalls,
    async writeDump(location, data, mimeType) {
      written.push({ location, data, mimeType });
    },
    async readDump() {
      throw new Error("not used in these tests");
    },
    async pickFile() {
      return null;
    },
    async pickFiles() {
      return null;
    },
    async pickSaveLocation(suggestedName, title, filter) {
      saveLocationCalls.push({ suggestedName, title, filter });
      return saveLocation;
    },
    async getAutoBackupLocation(suggestedName) {
      return `backups/${suggestedName}`;
    },
  };
}

describe("repository: downloadMaterialOriginal (task J)", () => {
  async function createFormMaterial(originalName: string, bytes: Uint8Array) {
    return createMaterial({
      type: "form",
      sectionId: "section:test",
      title: "Form",
      file: {
        original: { attachment: "original", name: originalName, ext: "docx", size: bytes.length },
        pdf: { attachment: "pdf", size: 10 },
      },
      attachments: {
        original: { content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", data: uint8ArrayToBase64(bytes) },
        pdf: { content_type: "application/pdf", data: uint8ArrayToBase64(new Uint8Array([1])) },
      },
      createdBy: "test",
    });
  }

  beforeEach(async () => {
    await initRepository({ contentDb, systemDb, seed: false });
    await contentDb.put(makeSectionDoc("section:test", "Test section"));
  });

  it("hands out the original under its source name via filePort (not the PDF)", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const material = await createFormMaterial("Intake questionnaire.docx", bytes);
    const filePort = createFakeFilePort("save-here");
    await initRepository({ contentDb, systemDb, seed: false, filePort });

    const ok = await downloadMaterialOriginal(material._id);

    expect(ok).toBe(true);
    expect(filePort.written).toHaveLength(1);
    expect(filePort.written[0].location).toBe("save-here");
    expect(filePort.written[0].data).toEqual(bytes);
  });

  it("a save location pick cancelled by the user -> false, nothing written", async () => {
    const material = await createFormMaterial("Form.docx", new Uint8Array([9]));
    const filePort = createFakeFilePort(null);
    await initRepository({ contentDb, systemDb, seed: false, filePort });

    const ok = await downloadMaterialOriginal(material._id);

    expect(ok).toBe(false);
    expect(filePort.written).toHaveLength(0);
  });

  it("throws a clear error for a non-file material (article)", async () => {
    const article = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Article",
      body: buildOutputData([eBlockParagraph("Text.")]),
      createdBy: "test",
    });
    const filePort = createFakeFilePort();
    await initRepository({ contentDb, systemDb, seed: false, filePort });

    await expect(downloadMaterialOriginal(article._id)).rejects.toThrow(/file type/);
  });
});

describe("repository: getMaterialPdfUrl — the attachment key is taken from the document", () => {
  const captured: unknown[] = [];
  async function bytesOf(value: unknown): Promise<Uint8Array> {
    if (value instanceof Uint8Array) return Uint8Array.from(value);
    return new Uint8Array(await (value as Blob).arrayBuffer());
  }

  beforeEach(async () => {
    await initRepository({ contentDb, systemDb, seed: false });
    await contentDb.put(makeSectionDoc("section:test", "Test section"));
    captured.length = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      captured.push(blob);
      return `blob:test/${captured.length}`;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function createFileMaterial(
    pdfAttachmentKey: string,
    attachments: Record<string, { content_type: string; data: string }>,
  ) {
    return createMaterial({
      type: "presentation",
      sectionId: "section:test",
      title: "Presentation",
      file: {
        original: { attachment: "original", name: "Presentation.pdf", ext: "pdf", size: 3 },
        pdf: { attachment: pdfAttachmentKey, size: 3 },
      },
      attachments,
      createdBy: "test",
    });
  }

  it("the source is already a PDF: a single attachment under the original key — hands that one out", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const material = await createFileMaterial("original", {
      original: { content_type: "application/pdf", data: uint8ArrayToBase64(bytes) },
    });

    const url = await getMaterialPdfUrl(material._id);

    expect(url).toBe("blob:test/1");
    expect(await bytesOf(captured[0])).toEqual(bytes);
  });

  it("a docx+pdf pair: two different attachments — hands out exactly the pdf, not the original", async () => {
    const pdfBytes = new Uint8Array([9, 9, 9]);
    const material = await createFileMaterial("pdf", {
      original: { content_type: "application/pdf", data: uint8ArrayToBase64(new Uint8Array([1])) },
      pdf: { content_type: "application/pdf", data: uint8ArrayToBase64(pdfBytes) },
    });

    await getMaterialPdfUrl(material._id);

    expect(await bytesOf(captured[0])).toEqual(pdfBytes);
  });

  it("a non-file material — a clear error, not a silent attachment 404", async () => {
    const article = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Article",
      body: buildOutputData([eBlockParagraph("Text.")]),
      createdBy: "test",
    });

    await expect(getMaterialPdfUrl(article._id)).rejects.toThrow(/file type/);
  });
});

describe("repository: downloadMaterialAttachment (U2.1 — the shared mechanism)", () => {
  beforeEach(async () => {
    await initRepository({ contentDb, systemDb, seed: false });
    await contentDb.put(makeSectionDoc("section:test", "Test section"));
  });

  it("downloads an arbitrary attachment (an attaches block in the article body) by key and name", async () => {
    const bytes = new Uint8Array([7, 8, 9]);
    const article = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Article with a file",
      body: buildOutputData([eBlockParagraph("Text.")]),
      createdBy: "test",
    });
    await addMaterialAttachment(article._id, "file-1", "application/pdf", uint8ArrayToBase64(bytes));
    const filePort = createFakeFilePort("save-here");
    await initRepository({ contentDb, systemDb, seed: false, filePort });

    const ok = await downloadMaterialAttachment(article._id, "file-1", "Attachment.pdf");

    expect(ok).toBe(true);
    expect(filePort.written).toHaveLength(1);
    expect(filePort.written[0].location).toBe("save-here");
    expect(filePort.written[0].data).toEqual(bytes);
  });

  it("a cancelled save location pick -> false, nothing written", async () => {
    const article = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Article with a file",
      body: buildOutputData([eBlockParagraph("Text.")]),
      createdBy: "test",
    });
    await addMaterialAttachment(article._id, "file-1", "application/pdf", uint8ArrayToBase64(new Uint8Array([1])));
    const filePort = createFakeFilePort(null);
    await initRepository({ contentDb, systemDb, seed: false, filePort });

    const ok = await downloadMaterialAttachment(article._id, "file-1", "Attachment.pdf");

    expect(ok).toBe(false);
    expect(filePort.written).toHaveLength(0);
  });

  it("a nonexistent attachment key -> the error propagates, not swallowed", async () => {
    const article = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Article without a file",
      body: buildOutputData([eBlockParagraph("Text.")]),
      createdBy: "test",
    });
    const filePort = createFakeFilePort();
    await initRepository({ contentDb, systemDb, seed: false, filePort });

    await expect(downloadMaterialAttachment(article._id, "no-such-key", "x.pdf")).rejects.toThrow();
    expect(filePort.written).toHaveLength(0);
  });

  it("P2.2: the first bytes of the downloaded PDF are %PDF, not the document's serialized JSON; the filter/mime is not a database dump (JSON)", async () => {
    const pdfBytes = createPlaceholderPdf("Presentation");
    const article = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Article with a PDF attachment",
      body: buildOutputData([eBlockParagraph("Text.")]),
      createdBy: "test",
    });
    await addMaterialAttachment(article._id, "file-1", "application/pdf", uint8ArrayToBase64(pdfBytes));
    const filePort = createFakeFilePort("save-here");
    await initRepository({ contentDb, systemDb, seed: false, filePort });

    const ok = await downloadMaterialAttachment(article._id, "file-1", "Presentation.pdf");

    expect(ok).toBe(true);
    expect(filePort.written).toHaveLength(1);
    const written = filePort.written[0];
    const magicBytes = new TextDecoder().decode(written.data.slice(0, 4));
    expect(magicBytes).toBe("%PDF");
    expect(written.data[0]).not.toBe("{".charCodeAt(0));
    expect(written.mimeType).toBe("application/pdf");
    expect(filePort.saveLocationCalls[0].filter).toEqual({ label: "PDF", extensions: ["pdf"] });
  });
});

describe("repository: logAppEvent/getAppLog (P4.3)", () => {
  beforeEach(async () => {
    await initRepository({ contentDb, systemDb, seed: false });
  });

  it("logAppEvent writes an applog document, getAppLog returns newest first", async () => {
    await logAppEvent("info", "test.first", { a: 1 });
    await logAppEvent("error", "test.second", { b: 2 });

    const entries = await getAppLog();

    expect(entries.length).toBe(2);
    expect(entries[0].event).toBe("test.second");
    expect(entries[0].level).toBe("error");
    expect(entries[1].event).toBe("test.first");
  });

  it("getAppLog respects the limit", async () => {
    for (let i = 0; i < 5; i++) {
      await logAppEvent("info", `test.${i}`);
    }
    const entries = await getAppLog(2);
    expect(entries.length).toBe(2);
  });
});

describe("repository: exportDiagnosticsLog (P4.3)", () => {
  const environment = {
    userAgent: "test-agent",
    platform: "test-platform",
    hardwareConcurrency: 4,
    deviceMemory: 8,
    liteMode: false,
  };

  beforeEach(async () => {
    await initRepository({ contentDb, systemDb, seed: false });
  });

  it("exports readable JSON with versions/counters/environment/applog, without users or material contents", async () => {
    await contentDb.put(makeSectionDoc("section:test", "Test section"));
    await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Material with secret content for the leak check",
      body: buildOutputData([eBlockParagraph("Personal client data must not end up in diagnostics.")]),
      createdBy: "test",
    });
    await logAppEvent("warn", "test.event", { docId: "material:test" });

    const filePort = createFakeFilePort("diag-location");
    await initRepository({ contentDb, systemDb, seed: false, filePort });

    const ok = await exportDiagnosticsLog(environment);

    expect(ok).toBe(true);
    expect(filePort.written).toHaveLength(1);
    expect(filePort.written[0].mimeType).toBe("application/json");
    const report = JSON.parse(new TextDecoder().decode(filePort.written[0].data));

    expect(report.schemaVersion).toBe(SCHEMA_VERSION);
    expect(typeof report.appVersion).toBe("string");
    expect(report.documents.content).toBeGreaterThan(0);
    expect(report.environment).toEqual(environment);
    expect(report.appLog.some((e: { event: string }) => e.event === "test.event")).toBe(true);

    const json = JSON.stringify(report);
    expect(json).not.toContain("Personal client data");
    expect(json).not.toContain("Material with secret content");
  });

  it("a cancelled save location pick -> false, nothing written", async () => {
    const filePort = createFakeFilePort(null);
    await initRepository({ contentDb, systemDb, seed: false, filePort });

    const ok = await exportDiagnosticsLog(environment);

    expect(ok).toBe(false);
    expect(filePort.written).toHaveLength(0);
  });

  it("caps the file size at 5 MB: old applog entries are cut first, fresh ones stay", async () => {
    const bigContext = { blob: "x".repeat(15_000) };
    for (let i = 0; i < 500; i++) {
      await logAppEvent("info", `bulk.${i}`, bigContext);
    }
    const filePort = createFakeFilePort("diag-location");
    await initRepository({ contentDb, systemDb, seed: false, filePort });

    const ok = await exportDiagnosticsLog(environment);
    expect(ok).toBe(true);

    const bytes = filePort.written[0].data;
    expect(bytes.length).toBeLessThanOrEqual(5 * 1024 * 1024);
    const report = JSON.parse(new TextDecoder().decode(bytes));
    expect(report.appLog[0].event).toBe("bulk.499");
    expect(report.appLog.length).toBeLessThan(500);
  }, 30_000);
});

describe("repository: exportChangeLogToFile (P12, task 1.5)", () => {
  beforeEach(async () => {
    await initRepository({ contentDb, systemDb, seed: false });
    await contentDb.put(makeSectionDoc("section:test", "Test section"));
  });

  it("exports the given (already caller-filtered) entries as JSON, a different file than diagnostics", async () => {
    const filePort = createFakeFilePort("journal-location");
    await initRepository({ contentDb, systemDb, seed: false, filePort });
    const created = await createMaterial({
      type: "article",
      sectionId: "section:test",
      title: "Material for the journal",
      body: buildOutputData([eBlockParagraph("Text.")]),
      createdBy: "consultant-1",
    });

    const entries = await getChangeLog();
    const ok = await exportChangeLogToFile(entries);

    expect(ok).toBe(true);
    expect(filePort.written).toHaveLength(1);
    expect(filePort.written[0].mimeType).toBe("application/json");
    expect(filePort.saveLocationCalls[0].suggestedName).toMatch(/^aurora-journal-.*\.json$/);

    const parsed = JSON.parse(new TextDecoder().decode(filePort.written[0].data));
    expect(Array.isArray(parsed.entries)).toBe(true);
    expect(parsed.entries.some((e: { targetId: string }) => e.targetId === created._id)).toBe(true);
    expect(typeof parsed.generatedAt).toBe("string");
  });

  it("a cancelled save location pick -> false, nothing written", async () => {
    const filePort = createFakeFilePort(null);
    await initRepository({ contentDb, systemDb, seed: false, filePort });

    const ok = await exportChangeLogToFile(await getChangeLog());
    expect(ok).toBe(false);
    expect(filePort.written).toHaveLength(0);
  });
});
