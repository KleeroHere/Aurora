import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import { createContentDb, createSystemDb } from "./db";
import { ulid } from "./ulid";
import {
  CHANGE_LOG_PAGE_SIZE,
  MATERIAL_HISTORY_LIMIT,
  getChangeLog,
  getChangeLogForMaterial,
  initRepository,
  shutdownRepository,
} from "./repository";
import { SCHEMA_VERSION } from "./types";
import type { Change } from "./types";

const ENTRY_COUNT = 4000;
const WATCHED_MATERIAL = "article:programma__nablyudaemyy";

let contentDb: PouchDB.Database;
let systemDb: PouchDB.Database;
let docsReadByAllDocs = 0;

function makeChange(index: number, targetId: string): Change {
  return {
    _id: `change:${ulid()}`,
    type: "change",
    schemaVersion: SCHEMA_VERSION,
    targetId,
    targetType: "article",
    targetTitle: `Material ${index}`,
    op: "update",
    userId: "user:test",
    at: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString(),
  };
}

beforeEach(async () => {
  contentDb = createContentDb(NodePouchDB, createNodeDbOptions());
  systemDb = createSystemDb(NodePouchDB, createNodeDbOptions());
  await initRepository({ contentDb, systemDb, seed: false });

  const entries: Change[] = [];
  for (let i = 0; i < ENTRY_COUNT; i += 1) {
    const targetId = i % 500 === 0 ? WATCHED_MATERIAL : `article:programma__inoy-${i}`;
    entries.push(makeChange(i, targetId));
  }
  await systemDb.bulkDocs(entries as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>[]);

  docsReadByAllDocs = 0;
  const realAllDocs = systemDb.allDocs.bind(systemDb);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (systemDb as any).allDocs = async (options: any) => {
    const result = await realAllDocs(options);
    if (options?.include_docs) docsReadByAllDocs += result.rows.length;
    return result;
  };
});

afterEach(async () => {
  await shutdownRepository();
  await contentDb.destroy().catch(() => undefined);
  await systemDb.destroy().catch(() => undefined);
});

describe("edit history of a single material on a large database", () => {
  it("finds all of its own entries and none of anyone else's", async () => {
    const history = await getChangeLogForMaterial(WATCHED_MATERIAL);

    expect(history.length).toBe(ENTRY_COUNT / 500);
    expect(history.every((entry) => entry.targetId === WATCHED_MATERIAL)).toBe(true);
  });

  it("does NOT read the whole log - that was the whole point", async () => {
    await getChangeLogForMaterial(WATCHED_MATERIAL);

    expect(docsReadByAllDocs).toBeLessThan(ENTRY_COUNT / 10);
  });

  it("the query uses the INDEX, not a full scan", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const explained = await (systemDb as any).explain({
      selector: { targetId: WATCHED_MATERIAL, at: { $gt: null } },
      sort: [{ targetId: "desc" }, { at: "desc" }],
      limit: MATERIAL_HISTORY_LIMIT,
    });

    expect(explained.index.name).toBe("idx_change_target_at");
    expect(explained.index.type).toBe("json");
  });

  it("returns newest to oldest - history reads top down", async () => {
    const history = await getChangeLogForMaterial(WATCHED_MATERIAL);

    const dates = history.map((entry) => entry.at);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("the result is capped: a material with hundreds of edits does not crash the page", async () => {
    const many: Change[] = [];
    for (let i = 0; i < 300; i += 1) many.push(makeChange(10_000 + i, "article:programma__chasto-pravimyy"));
    await systemDb.bulkDocs(many as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>[]);

    const history = await getChangeLogForMaterial("article:programma__chasto-pravimyy");

    expect(history.length).toBe(MATERIAL_HISTORY_LIMIT);
  });

  it("a material with no edits has an empty history, not an error", async () => {
    await expect(getChangeLogForMaterial("article:programma__nikogda-ne-pravili")).resolves.toEqual([]);
  });
});

describe("global change log", () => {
  it("loads a page by default, not the whole log", async () => {
    const entries = await getChangeLog();

    expect(entries.length).toBe(CHANGE_LOG_PAGE_SIZE);
    expect(docsReadByAllDocs).toBeLessThanOrEqual(CHANGE_LOG_PAGE_SIZE);
  });

  it("the page is the MOST RECENT entries, not a random slice", async () => {
    const entries = await getChangeLog();

    const dates = entries.map((entry) => entry.at);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(entries[0].targetTitle).toBe(`Material ${ENTRY_COUNT - 1}`);
  });

  it("an explicit zero means \"the whole log\" - file export must handle everything", async () => {
    const entries = await getChangeLog(0);

    expect(entries.length).toBe(ENTRY_COUNT);
  });
});
