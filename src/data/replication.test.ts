import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import { SCHEMA_VERSION } from "./types";
import {
  REPLICATION_SETTINGS_ID,
  ReplicationAuthError,
  ReplicationForbiddenError,
  ReplicationNotConfiguredError,
  ReplicationUnreachableError,
  activeServer,
  countConflicts,
  defaultReplicationSettings,
  describeReplicationError,
  isReplicableDocId,
  loadReplicationSettings,
  describeDocId,
  docTypeFromId,
  isMaterialType,
  previewSyncOnce,
  revGeneration,
  runReplication,
  saveReplicationSettings,
  syncOnce,
  toLastSyncRecords,
} from "./replication";
import type { ReplicationServer } from "./replication";

const REAL_COUCH_URL = process.env.AURORA_COUCH_URL?.replace(/\/+$/, "") ?? "";
const againstRealCouch = REAL_COUCH_URL.length > 0;

let serverUrl: string;
let closeServer: () => Promise<void>;

const remoteDbsToDrop: string[] = [];

const RUN_STAMP = `${Date.now().toString(36)}${process.pid.toString(36)}`;

async function couchFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    const url = new URL(`${serverUrl}${path}`);
    const credentials = url.username ? `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}` : "";
    url.username = "";
    url.password = "";
    return await fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(credentials ? { Authorization: `Basic ${btoa(credentials)}` } : {}),
      },
    });
  } catch {
    return null;
  }
}

beforeAll(async () => {
  if (againstRealCouch) {
    serverUrl = REAL_COUCH_URL;
    closeServer = async () => undefined;
    return;
  }
  const mod = await import("../../../scripts/couch_local_server.mjs");
  const started = await mod.startCouchLocalServer(0);
  serverUrl = started.url;
  closeServer = started.close;
}, 30000);

afterAll(async () => {
  if (againstRealCouch) {
    for (const db of remoteDbsToDrop) await couchFetch(`/${db}`, { method: "DELETE" });
    for (const [db, id] of [
      ["aurora-system", "user:01TEST"],
      ["aurora-content", "article:polnyy"],
    ]) {
      const found = await couchFetch(`/${db}/${encodeURIComponent(id)}`);
      if (!found?.ok) continue;
      const doc = (await found.json()) as { _rev: string };
      await couchFetch(`/${db}/${encodeURIComponent(id)}?rev=${doc._rev}`, { method: "DELETE" });
    }
  }
  await closeServer?.();
}, 60000);

const SERVER: ReplicationServer = { id: "primary", label: "Test rig", url: "", username: "", password: "" };

let counter = 0;
function freshDb(name: string): PouchDB.Database {
  counter += 1;
  return new NodePouchDB(`${name}-${counter}`, createNodeDbOptions());
}

function remoteName(): string {
  counter += 1;
  const name = againstRealCouch ? `repl-test-${RUN_STAMP}-${counter}` : `repl-test-${counter}`;
  if (againstRealCouch) remoteDbsToDrop.push(name);
  return `${serverUrl}/${name}`;
}

describe("server settings are not a constant in the code", () => {
  let systemDb: PouchDB.Database;
  beforeEach(() => {
    systemDb = freshDb("settings-system");
  });
  afterEach(async () => {
    await systemDb.destroy().catch(() => undefined);
  });

  it("on an empty database returns defaults with two addresses", async () => {
    const settings = await loadReplicationSettings(systemDb);
    expect(settings.servers.map((s) => s.id)).toEqual(["primary", "fallback"]);
    expect(settings.activeServerId).toBe("primary");
    expect(activeServer(settings)).toBeNull();
  });

  it("settings save and survive a reload", async () => {
    await saveReplicationSettings(systemDb, {
      servers: [
        { id: "primary", label: "Primary server", url: "http://10.0.0.5:5984", username: "sync", password: "x" },
        { id: "fallback", label: "Temporary hub", url: "http://hub:5984", username: "", password: "" },
      ],
      activeServerId: "fallback",
    });

    const reloaded = await loadReplicationSettings(systemDb);
    expect(reloaded.activeServerId).toBe("fallback");
    expect(activeServer(reloaded)?.url).toBe("http://hub:5984");
    expect(reloaded._id).toBe(REPLICATION_SETTINGS_ID);
    expect(reloaded.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("an older-version document without the second address is filled in rather than breaking the load", async () => {
    await systemDb.put({
      _id: REPLICATION_SETTINGS_ID,
      type: "settings",
      schemaVersion: SCHEMA_VERSION,
      servers: [{ id: "primary", label: "Primary server", url: "http://old:5984", username: "", password: "" }],
      activeServerId: "primary",
      updatedAt: new Date().toISOString(),
    } as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);

    const settings = await loadReplicationSettings(systemDb);
    expect(settings.servers.map((s) => s.id)).toEqual(["primary", "fallback"]);
    expect(settings.servers[0].url).toBe("http://old:5984");
  });
});

describe("what must not travel between machines", () => {
  it("the seed marker, the log, the shelf and the indexes are filtered out", () => {
    expect(isReplicableDocId("probe:permissions-check")).toBe(false);
    expect(isReplicableDocId("seedstate")).toBe(false);
    expect(isReplicableDocId("applog:01AAA")).toBe(false);
    expect(isReplicableDocId("pin:user:01AAA:material:x")).toBe(false);
    expect(isReplicableDocId("_design/idx_material_updated")).toBe(false);
  });

  it("materials, sections, accounts and the change log do travel", () => {
    for (const id of ["article:x", "section:y", "user:01AAA", "change:01BBB", "settings:replication"]) {
      expect(isReplicableDocId(id)).toBe(true);
    }
  });
});

describe("sync through the server", () => {
  it("edits travel both ways between two profiles", async () => {
    const url = remoteName();
    const first = freshDb("profile-a");
    const second = freshDb("profile-b");
    try {
      await first.put({ _id: "article:iz-pervogo", type: "article", title: "From the first profile" });
      await second.put({ _id: "article:iz-vtorogo", type: "article", title: "From the second profile" });

      const a = await syncOnce(NodePouchDB, first, url, SERVER);
      const b = await syncOnce(NodePouchDB, second, url, SERVER);
      const aAgain = await syncOnce(NodePouchDB, first, url, SERVER);

      expect(a.ok && b.ok && aAgain.ok).toBe(true);
      await expect(second.get("article:iz-pervogo")).resolves.toMatchObject({ title: "From the first profile" });
      await expect(first.get("article:iz-vtorogo")).resolves.toMatchObject({ title: "From the second profile" });
    } finally {
      await first.destroy().catch(() => undefined);
      await second.destroy().catch(() => undefined);
    }
  }, 30000);

  it("DELETION propagates: a material does not resurrect on the second machine (closes R6)", async () => {
    const url = remoteName();
    const first = freshDb("delete-a");
    const second = freshDb("delete-b");
    try {
      await first.put({ _id: "article:budet-udalyon", type: "article", title: "Alive for now" });
      await syncOnce(NodePouchDB, first, url, SERVER);
      await syncOnce(NodePouchDB, second, url, SERVER);
      await expect(second.get("article:budet-udalyon")).resolves.toBeTruthy();

      const doomed = await first.get("article:budet-udalyon");
      await first.remove(doomed);

      await syncOnce(NodePouchDB, first, url, SERVER);
      await syncOnce(NodePouchDB, second, url, SERVER);

      await expect(second.get("article:budet-udalyon")).rejects.toMatchObject({ status: 404 });

      await syncOnce(NodePouchDB, first, url, SERVER);
      await expect(first.get("article:budet-udalyon")).rejects.toMatchObject({ status: 404 });
    } finally {
      await first.destroy().catch(() => undefined);
      await second.destroy().catch(() => undefined);
    }
  }, 30000);

  it("editing one material in two offline profiles yields competing revisions, and they are reported", async () => {
    const url = remoteName();
    const first = freshDb("conflict-a");
    const second = freshDb("conflict-b");
    try {
      await first.put({ _id: "article:spornyy", type: "article", title: "Original" });
      await syncOnce(NodePouchDB, first, url, SERVER);
      await syncOnce(NodePouchDB, second, url, SERVER);

      const inFirst = await first.get<{ title: string }>("article:spornyy");
      await first.put({ ...inFirst, title: "First profile's edit" });
      const inSecond = await second.get<{ title: string }>("article:spornyy");
      await second.put({ ...inSecond, title: "Second profile's edit" });

      await syncOnce(NodePouchDB, first, url, SERVER);
      await syncOnce(NodePouchDB, second, url, SERVER);
      const back = await syncOnce(NodePouchDB, first, url, SERVER);

      const winnerFirst = await first.get<{ title: string }>("article:spornyy");
      const winnerSecond = await second.get<{ title: string }>("article:spornyy");
      expect(winnerFirst.title).toBe(winnerSecond.title);
      expect(["First profile's edit", "Second profile's edit"]).toContain(winnerFirst.title);

      expect(await countConflicts(first)).toBeGreaterThan(0);
      expect(back.conflicts).toBeGreaterThan(0);
    } finally {
      await first.destroy().catch(() => undefined);
      await second.destroy().catch(() => undefined);
    }
  }, 30000);

  it("an attachment arrives whole, byte for byte", async () => {
    const url = remoteName();
    const first = freshDb("attach-a");
    const second = freshDb("attach-b");
    try {
      const size = 1536 * 1024;
      const bytes = new Uint8Array(size);
      for (let i = 0; i < size; i += 1) bytes[i] = (i * 31 + 7) % 256;

      await first.put({ _id: "presentation:tyazholaya", type: "presentation", title: "Heavy" });
      const doc = await first.get("presentation:tyazholaya");
      await first.putAttachment("presentation:tyazholaya", "pdf", doc._rev, Buffer.from(bytes), "application/pdf");

      await syncOnce(NodePouchDB, first, url, SERVER, { batchSize: 2 });
      await syncOnce(NodePouchDB, second, url, SERVER, { batchSize: 2 });

      const arrived = (await second.getAttachment("presentation:tyazholaya", "pdf")) as Buffer;
      expect(arrived.length).toBe(size);
      expect(Array.from(arrived)).toEqual(Array.from(bytes));
    } finally {
      await first.destroy().catch(() => undefined);
      await second.destroy().catch(() => undefined);
    }
  }, 60000);
});

describe("connection drop in the middle of a sync", () => {
  it("the app does not crash, the database stays intact, a repeat pass finishes the job", async () => {
    //
    //
    let instance: { url: string; port: number; close: () => Promise<void> };
    let restart: () => Promise<typeof instance>;

    if (againstRealCouch) {
      const { startTcpProxy } = await import("../../../scripts/tcp_proxy.mjs");
      const target = new URL(REAL_COUCH_URL);
      const targetPort = Number(target.port || 5984);
      const credentials = target.username ? `${target.username}:${target.password}@` : "";
      const spawn = async (listenPort: number) => {
        const proxy = await startTcpProxy({ targetHost: target.hostname, targetPort, listenPort });
        return {
          url: `http://${credentials}127.0.0.1:${proxy.port}`,
          port: proxy.port,
          close: () => proxy.close(),
        };
      };
      instance = await spawn(0);
      const port = instance.port;
      restart = () => spawn(port);
    } else {
      const mod = await import("../../../scripts/couch_local_server.mjs");
      const store = mod.createStore();
      instance = await mod.startCouchLocalServer(0, { store });
      const port = instance.port;
      restart = () => mod.startCouchLocalServer(port, { store });
    }

    const brokenDb = againstRealCouch ? `broken-link-${RUN_STAMP}` : "broken-link";
    const remote = `${instance.url}/${brokenDb}`;
    if (againstRealCouch) remoteDbsToDrop.push(brokenDb);

    const local = freshDb("interrupted");
    try {
      const docs = Array.from({ length: 30 }, (_, i) => ({
        _id: `article:kusok-${String(i).padStart(3, "0")}`,
        type: "article",
        title: `Chunk ${i}`,
        body: "x".repeat(8000),
      }));
      await local.bulkDocs(docs);

      const running = syncOnce(NodePouchDB, local, remote, SERVER, { batchSize: 2 }).catch((err) => err);
      await new Promise((r) => setTimeout(r, 120));
      await instance.close();
      const outcome = await running;

      expect(outcome instanceof Error ? outcome.name : "finished").toMatch(
        /ReplicationUnreachableError|Error|finished/,
      );

      const afterBreak = await local.allDocs();
      expect(afterBreak.rows.filter((r) => r.id.startsWith("article:")).length).toBe(30);

      instance = await restart();
      const second = await syncOnce(NodePouchDB, local, remote, SERVER, { batchSize: 10 });
      let third = second;
      for (let i = 0; i < 12 && third.docsWritten > 0; i += 1) {
        third = await syncOnce(NodePouchDB, local, remote, SERVER, { batchSize: 10 });
      }

      const onServer = new NodePouchDB(remote);
      const info = await onServer.info();
      expect(info.doc_count).toBe(30);
    } finally {
      await local.destroy().catch(() => undefined);
      await instance.close().catch(() => undefined);
    }
  }, 60000);
});

describe("no server is a normal state, not an emergency", () => {
  it("an unreachable server yields a human message, not a stack trace", async () => {
    const local = freshDb("offline");
    try {
      await expect(syncOnce(NodePouchDB, local, "http://127.0.0.1:1/aurora-content", SERVER)).rejects.toBeInstanceOf(
        ReplicationUnreachableError,
      );
    } finally {
      await local.destroy().catch(() => undefined);
    }
  }, 30000);

  it("after a failed pass the local database is intact and works as before", async () => {
    const local = freshDb("intact");
    try {
      await local.put({ _id: "article:tselaya", type: "article", title: "Intact" });
      await syncOnce(NodePouchDB, local, "http://127.0.0.1:1/aurora-content", SERVER).catch(() => undefined);
      await expect(local.get("article:tselaya")).resolves.toMatchObject({ title: "Intact" });
    } finally {
      await local.destroy().catch(() => undefined);
    }
  }, 30000);

  it("an unset address is a distinct error with a hint on what to do", async () => {
    const systemDb = freshDb("unconfigured-system");
    const contentDb = freshDb("unconfigured-content");
    try {
      await expect(
        runReplication(NodePouchDB, systemDb, contentDb, defaultReplicationSettings()),
      ).rejects.toBeInstanceOf(ReplicationNotConfiguredError);
    } finally {
      await systemDb.destroy().catch(() => undefined);
      await contentDb.destroy().catch(() => undefined);
    }
  });

  it('a name-and-password refusal is distinct from "server not responding"', () => {
    expect(describeReplicationError({ status: 401 }, "http://x")).toBeInstanceOf(ReplicationAuthError);
    expect(describeReplicationError({ status: 403 }, "http://x")).toBeInstanceOf(ReplicationAuthError);
    expect(describeReplicationError(new TypeError("Failed to fetch"), "http://x")).toBeInstanceOf(
      ReplicationUnreachableError,
    );
    expect(describeReplicationError({ status: 500, message: "boom" }, "http://x").message).toContain("boom");

    const wrongPassword = describeReplicationError(
      { status: 401, name: "unauthorized", reason: "Name or password is incorrect." },
      "http://x",
    );
    const notServerAdmin = describeReplicationError(
      { status: 401, name: "unauthorized", reason: "You are not a server admin." },
      "http://x",
    );
    const foreignDb = describeReplicationError(
      { status: 403, name: "forbidden", reason: "You are not allowed to access this db." },
      "http://x",
    );

    expect(wrongPassword).toBeInstanceOf(ReplicationAuthError);
    expect(wrongPassword).not.toBeInstanceOf(ReplicationForbiddenError);
    expect(notServerAdmin).toBeInstanceOf(ReplicationForbiddenError);
    expect(foreignDb).toBeInstanceOf(ReplicationForbiddenError);

    expect(wrongPassword.message).toMatch(/did not accept the name or password/);
    expect(notServerAdmin.message).toMatch(/accepted the name and password but did not grant permission/);
    expect(foreignDb.message).toMatch(/accepted the name and password but did not grant permission/);
    expect(notServerAdmin.message).not.toBe(wrongPassword.message);
  });
});

describe("full sync: accounts first, then materials", () => {
  it("both databases sync, with a separate report for each", async () => {
    const base = `${serverUrl}`;
    const systemDb = freshDb("full-system");
    const contentDb = freshDb("full-content");
    try {
      await systemDb.put({ _id: "user:01TEST", type: "user", login: "Test", displayName: "Test" });
      await contentDb.put({ _id: "article:polnyy", type: "article", title: "Full sync" });

      const settings = {
        ...defaultReplicationSettings(),
        servers: [
          { id: "primary" as const, label: "Test rig", url: base, username: "", password: "" },
          { id: "fallback" as const, label: "Hub", url: "", username: "", password: "" },
        ],
      };

      const outcomes = await runReplication(NodePouchDB, systemDb, contentDb, settings);
      expect(outcomes).toHaveLength(2);
      expect(outcomes.every((o) => o.ok)).toBe(true);

      const records = toLastSyncRecords(outcomes);
      expect(records).toHaveLength(2);
      expect(records[0].at).toBeTruthy();
      expect(records.map((r) => r.database)).toEqual(outcomes.map((o) => o.database));
    } finally {
      await systemDb.destroy().catch(() => undefined);
      await contentDb.destroy().catch(() => undefined);
    }
  }, 60000);

  it("unreachable server: there is a report for each database, no exception escapes", async () => {
    const systemDb = freshDb("down-system");
    const contentDb = freshDb("down-content");
    try {
      const settings = {
        ...defaultReplicationSettings(),
        servers: [
          { id: "primary" as const, label: "Test rig", url: "http://127.0.0.1:1", username: "", password: "" },
          { id: "fallback" as const, label: "Hub", url: "", username: "", password: "" },
        ],
      };
      const outcomes = await runReplication(NodePouchDB, systemDb, contentDb, settings);
      expect(outcomes).toHaveLength(2);
      expect(outcomes.every((o) => !o.ok)).toBe(true);
      for (const o of outcomes) expect(o.message).toMatch(/is not responding/);
    } finally {
      await systemDb.destroy().catch(() => undefined);
      await contentDb.destroy().catch(() => undefined);
    }
  }, 30000);
});

describe("sync preview: what will change, before it changes", () => {
  it("when both sides agree there is nothing to change", async () => {
    const url = remoteName();
    const local = freshDb("preview-same");
    try {
      await local.put({ _id: "article:one", type: "article", title: "One" });
      await syncOnce(NodePouchDB, local, url, SERVER);

      const preview = await previewSyncOnce(NodePouchDB, local, url, SERVER);
      expect(preview.ok).toBe(true);
      expect(Object.values(preview.counts).reduce((a, b) => a + b, 0)).toBe(0);
      expect(preview.items).toEqual([]);
    } finally {
      await local.destroy().catch(() => undefined);
    }
  }, 30000);

  it("a document not here shows as incoming — with its title, not its id", async () => {
    const url = remoteName();
    const author = freshDb("preview-author");
    const reader = freshDb("preview-reader");
    try {
      await author.put({ _id: "article:server-only", type: "article", title: "Only on the server" });
      await syncOnce(NodePouchDB, author, url, SERVER);

      const preview = await previewSyncOnce(NodePouchDB, reader, url, SERVER);
      expect(preview.counts["incoming-new"]).toBe(1);
      expect(preview.items).toHaveLength(1);
      expect(preview.items[0]).toMatchObject({
        id: "article:server-only",
        kind: "incoming-new",
        title: "Only on the server",
        docType: "article",
      });
    } finally {
      await author.destroy().catch(() => undefined);
      await reader.destroy().catch(() => undefined);
    }
  }, 30000);

  it("an edit on the server is incoming, an edit here is outgoing", async () => {
    const url = remoteName();
    const first = freshDb("preview-in");
    const second = freshDb("preview-out");
    try {
      await first.put({ _id: "article:shared", type: "article", title: "Shared" });
      await syncOnce(NodePouchDB, first, url, SERVER);
      await syncOnce(NodePouchDB, second, url, SERVER);

      // The second profile edits and sends: for it that is outgoing, for the
      // first it is incoming.
      const mine = await second.get<{ _id: string; _rev: string; title: string }>("article:shared");
      await second.put({ ...mine, title: "Shared, edited on the second" });

      const outgoing = await previewSyncOnce(NodePouchDB, second, url, SERVER);
      expect(outgoing.counts["outgoing-updated"]).toBe(1);
      expect(outgoing.counts["incoming-updated"]).toBe(0);

      await syncOnce(NodePouchDB, second, url, SERVER);

      const incoming = await previewSyncOnce(NodePouchDB, first, url, SERVER);
      expect(incoming.counts["incoming-updated"]).toBe(1);
      expect(incoming.items[0]).toMatchObject({ id: "article:shared", kind: "incoming-updated" });
    } finally {
      await first.destroy().catch(() => undefined);
      await second.destroy().catch(() => undefined);
    }
  }, 30000);

  it("an edit on both sides is shown apart — this is what a sync stays silent about", async () => {
    const url = remoteName();
    const first = freshDb("preview-div-a");
    const second = freshDb("preview-div-b");
    try {
      await first.put({ _id: "article:contested", type: "article", title: "Contested" });
      await syncOnce(NodePouchDB, first, url, SERVER);
      await syncOnce(NodePouchDB, second, url, SERVER);

      // Both sides edit THEIR copy from a common ancestor and do not sync.
      const a = await first.get<{ _id: string; _rev: string; title: string }>("article:contested");
      await first.put({ ...a, title: "The first machine's version" });
      const b = await second.get<{ _id: string; _rev: string; title: string }>("article:contested");
      await second.put({ ...b, title: "The second machine's version" });
      await syncOnce(NodePouchDB, second, url, SERVER);

      const preview = await previewSyncOnce(NodePouchDB, first, url, SERVER);
      expect(preview.counts.diverging).toBe(1);
      expect(preview.items[0]).toMatchObject({ id: "article:contested", kind: "diverging" });
    } finally {
      await first.destroy().catch(() => undefined);
      await second.destroy().catch(() => undefined);
    }
  }, 30000);

  it("what never travels between machines does not reach the preview", async () => {
    const url = remoteName();
    const local = freshDb("preview-filtered");
    try {
      await local.put({ _id: "seedstate", status: "seeded" });
      await local.put({ _id: "applog:0001", level: "info" });
      await local.put({ _id: "pin:user:1:article:a" });
      await local.put({ _id: "probe:permissions-test" });

      const preview = await previewSyncOnce(NodePouchDB, local, url, SERVER);
      expect(Object.values(preview.counts).reduce((a, b) => a + b, 0)).toBe(0);
    } finally {
      await local.destroy().catch(() => undefined);
    }
  }, 30000);

  it("the revision generation is read from the string, and rubbish does not break it", () => {
    expect(revGeneration("1-abc")).toBe(1);
    expect(revGeneration("12-abc")).toBe(12);
    expect(revGeneration(undefined)).toBe(0);
    expect(revGeneration("rubbish")).toBe(0);
  });

  it("materials are told from housekeeping, and a nameless document gets a caption", () => {
    expect(isMaterialType("article")).toBe(true);
    expect(isMaterialType("form")).toBe(true);
    expect(isMaterialType("user")).toBe(false);
    expect(docTypeFromId("article:intake__the-intake-interview")).toBe("article");
    expect(docTypeFromId("nocolon")).toBe("other");
    expect(describeDocId("user:01ABC")).toContain("Account");
    expect(describeDocId(REPLICATION_SETTINGS_ID)).toBe("Sync settings");
  });
});
