import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import { createContentDb, createSystemDb } from "./db";
import { uint8ArrayToBase64 } from "./binary";
import { buildDumpHeader, DumpDocCountMismatchError, assertDumpDocCount } from "./dumpFormat";
import {
  UPKEEP_INTERVAL_DAYS,
  emptyUpkeepState,
  isUpkeepDue,
  loadUpkeepState,
  runDatabaseUpkeep,
} from "./upkeep";
import { APPLOG_KEEP_ENTRIES, initRepository, logAppEvent, pruneAppLog, shutdownRepository } from "./repository";

const NOW = new Date("2026-08-11T03:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("18.1 — checking the document count in a dump part", () => {
  it("a complete part passes", () => {
    expect(() => assertDumpDocCount({ header: buildDumpHeader(2), docs: [{}, {}] })).not.toThrow();
  });

  it("a truncated part is rejected, and the user is told what to do", () => {
    try {
      assertDumpDocCount({ header: buildDumpHeader(319), docs: [{}, {}] });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DumpDocCountMismatchError);
      expect((err as Error).message).toContain("319");
      expect((err as Error).message).toContain("did not finish copying");
    }
  });

  it("extra documents are a mismatch too: the file is not the one promised", () => {
    expect(() => assertDumpDocCount({ header: buildDumpHeader(1), docs: [{}, {}] })).toThrow(
      DumpDocCountMismatchError,
    );
  });

  it("a part without docCount is accepted — format compatibility is not broken", () => {
    const header = { ...buildDumpHeader(0) } as Record<string, unknown>;
    delete header.docCount;
    expect(() =>
      assertDumpDocCount({ header: header as never, docs: [{}, {}] }),
    ).not.toThrow();
  });
});

describe("18.2 — when to run upkeep", () => {
  it("never maintained — due", () => {
    expect(isUpkeepDue(emptyUpkeepState(), NOW)).toBe(true);
  });

  it("maintained yesterday — too early", () => {
    expect(isUpkeepDue({ ...emptyUpkeepState(), lastRunAt: daysAgo(1) }, NOW)).toBe(false);
  });

  it("exactly at the deadline — due", () => {
    expect(isUpkeepDue({ ...emptyUpkeepState(), lastRunAt: daysAgo(UPKEEP_INTERVAL_DAYS) }, NOW)).toBe(true);
  });

  it("a corrupted timestamp does not block upkeep forever", () => {
    expect(isUpkeepDue({ ...emptyUpkeepState(), lastRunAt: "not a date" }, NOW)).toBe(true);
  });
});

describe("18.2 — an upkeep pass", () => {
  let contentDb: PouchDB.Database;
  let systemDb: PouchDB.Database;

  beforeEach(async () => {
    contentDb = createContentDb(NodePouchDB, createNodeDbOptions());
    systemDb = createSystemDb(NodePouchDB, createNodeDbOptions());
    await initRepository({ contentDb, systemDb, seed: false });
  });

  afterEach(async () => {
    await shutdownRepository();
    await contentDb.destroy().catch(() => undefined);
    await systemDb.destroy().catch(() => undefined);
  });

  it("compacts BOTH databases and records itself in the system one", async () => {
    const result = await runDatabaseUpkeep({
      contentDb,
      systemDb,
      pruneAppLog: async () => 0,
      now: NOW,
    });

    expect(result.ran).toBe(true);
    expect(result.compacted).toEqual(["content", "system"]);
    expect((await loadUpkeepState(systemDb)).lastRunAt).toBe(NOW.toISOString());
  });

  it("a repeat call on the same day does nothing", async () => {
    await runDatabaseUpkeep({ contentDb, systemDb, pruneAppLog: async () => 0, now: NOW });
    const second = await runDatabaseUpkeep({ contentDb, systemDb, pruneAppLog: async () => 0, now: NOW });

    expect(second.ran).toBe(false);
    expect(second.compacted).toEqual([]);
  });

  it('force runs upkeep regardless of the deadline — the "do it now" button', async () => {
    await runDatabaseUpkeep({ contentDb, systemDb, pruneAppLog: async () => 0, now: NOW });
    const forced = await runDatabaseUpkeep({
      contentDb,
      systemDb,
      pruneAppLog: async () => 0,
      now: NOW,
      force: true,
    });

    expect(forced.ran).toBe(true);
  });

  it("pruning goes BEFORE compaction — otherwise the leftovers stay on disk", async () => {
    const order: string[] = [];
    const realCompact = contentDb.compact.bind(contentDb);
    vi.spyOn(contentDb, "compact").mockImplementation((async () => {
      order.push("compact");
      return realCompact();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    await runDatabaseUpkeep({
      contentDb,
      systemDb,
      pruneAppLog: async () => {
        order.push("prune");
        return 3;
      },
      now: NOW,
    });

    expect(order).toEqual(["prune", "compact"]);
    vi.restoreAllMocks();
  });

  it("an upkeep failure does not get in the way: a refusal is returned, not an exception", async () => {
    const result = await runDatabaseUpkeep({
      contentDb,
      systemDb,
      pruneAppLog: async () => {
        throw new Error("disk busy");
      },
      now: NOW,
    });

    expect(result.ran).toBe(false);
  });
});

describe("18.2 — pruning the application log", () => {
  let contentDb: PouchDB.Database;
  let systemDb: PouchDB.Database;

  beforeEach(async () => {
    contentDb = createContentDb(NodePouchDB, createNodeDbOptions());
    systemDb = createSystemDb(NodePouchDB, createNodeDbOptions());
    await initRepository({ contentDb, systemDb, seed: false });
  });

  afterEach(async () => {
    await shutdownRepository();
    await contentDb.destroy().catch(() => undefined);
    await systemDb.destroy().catch(() => undefined);
  });

  it("a short log is not touched at all", async () => {
    for (let i = 0; i < 5; i += 1) await logAppEvent("info", `event-${i}`);
    await expect(pruneAppLog()).resolves.toBe(0);
  });

  it("the excess is removed, the fresh entries stay", async () => {
    const keep = 10;
    for (let i = 0; i < 25; i += 1) await logAppEvent("info", `event-${i}`);

    const removed = await pruneAppLog(keep);

    expect(removed).toBe(15);
    const left = await systemDb.allDocs({ startkey: "applog:", endkey: "applog:￿", include_docs: true });
    const events = left.rows.map((row) => (row.doc as unknown as { event: string }).event);
    expect(events.length).toBe(keep);
    expect(events).toContain("event-24");
    expect(events).not.toContain("event-0");
  });

  it("the default threshold is noticeably higher than what is displayed", () => {
    expect(APPLOG_KEEP_ENTRIES).toBeGreaterThanOrEqual(1000);
  });
});

describe("18.1 — checking against real part contents", () => {
  it("a part assembled like a production dump passes the check", () => {
    const docs = Array.from({ length: 3 }, (_, i) => ({
      _id: `article:test__doc-${i}`,
      _attachments: { pdf: { content_type: "application/pdf", data: uint8ArrayToBase64(new Uint8Array([1])) } },
    }));
    expect(() => assertDumpDocCount({ header: buildDumpHeader(docs.length), docs })).not.toThrow();
  });
});
