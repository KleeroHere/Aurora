import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import { createContentDb, createSystemDb } from "./db";
import { buildDumpHeader, decodeDump, dumpDatabaseKind, encodeDump } from "./dumpFormat";
import type { ContentDump, DumpDoc } from "./dumpFormat";
import { WrongDumpDatabaseError } from "./dumpStream";
import { importContentDump } from "./sync";
import {
  SYSTEM_BACKUP_FILE_PREFIX,
  backupSystemDatabase,
  defaultSystemBackupFileName,
  restoreSystemDatabaseFromFiles,
  restoreSystemDumpParts,
  writeSystemBackup,
} from "./systemBackup";
import { changeUserPassword, createUser, verifyLogin } from "./users";
import type { FileHandle, FilePort } from "./filePort";

let systemDb: PouchDB.Database;
let contentDb: PouchDB.Database;

beforeEach(() => {
  systemDb = createSystemDb(NodePouchDB, createNodeDbOptions());
  contentDb = createContentDb(NodePouchDB, createNodeDbOptions());
});

afterEach(async () => {
  await systemDb.destroy().catch(() => undefined);
  await contentDb.destroy().catch(() => undefined);
});

function createFakeFilePort(selection: string[] = []): FilePort & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    async writeDump(location, data) {
      files.set(location as string, data);
    },
    async readDump(handle) {
      const bytes = files.get(handle as string);
      if (!bytes) throw new Error(`no file ${String(handle)}`);
      return bytes;
    },
    async pickFile() {
      return null;
    },
    async pickFiles() {
      return selection.length > 0 ? (selection as FileHandle[]) : null;
    },
    async pickSaveLocation(name) {
      return name;
    },
    async getAutoBackupLocation(name) {
      return `backups/${name}`;
    },
    fileName(handle) {
      return String(handle);
    },
  };
}

function freshSystemDb(name: string): PouchDB.Database {
  return new NodePouchDB(name, createNodeDbOptions());
}

async function fillSystemDb(db: PouchDB.Database): Promise<void> {
  await createUser(db, "Alex", "Alex", "secret-pass");
  await createUser(db, "Sam", "Sam", "other-pass");
  await db.put({
    _id: "pin:01ARZ3NDEKTSV4RRFFQ69G5FAV",
    type: "pin",
    schemaVersion: 1,
    materialId: "article:test__a",
    login: "Alex",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  });
  await db.put({
    _id: "change:01ARZ3NDEKTSV4RRFFQ69G5FAW",
    type: "change",
    schemaVersion: 1,
    materialId: "article:test__a",
    action: "update",
    by: "Alex",
    at: "2026-08-01T00:00:00.000Z",
  });
  await db.put({
    _id: "seedstate",
    type: "seedstate",
    schemaVersion: 1,
    status: "seeded",
    bundleCreatedAt: "2026-08-01T00:00:00.000Z",
    bundleDocCount: 3,
    seededAt: "2026-08-01T00:00:00.000Z",
    error: null,
  });
}

describe("a system database dump is distinguishable from a materials dump", () => {
  it("by file name", () => {
    expect(defaultSystemBackupFileName(new Date("2026-08-10T21:00:00.000Z"))).toBe(
      `${SYSTEM_BACKUP_FILE_PREFIX}2026-08-10T21-00-00Z.json`,
    );
  });

  it("by header: database=system on the system dump, absent on content", async () => {
    await fillSystemDb(systemDb);
    const filePort = createFakeFilePort();
    const written = await writeSystemBackup(filePort, systemDb);

    const dump = decodeDump(filePort.files.get(`backups/${written.fileNames[0]}`)!);
    expect(dump.header.database).toBe("system");
    expect(dumpDatabaseKind(dump.header)).toBe("system");

    expect(dumpDatabaseKind(buildDumpHeader(0))).toBe("content");
  });

  it("a system dump does NOT merge into the materials database — a clear error before the auto-backup", async () => {
    await fillSystemDb(systemDb);
    const filePort = createFakeFilePort();
    const written = await writeSystemBackup(filePort, systemDb);
    const systemBytes = filePort.files.get(`backups/${written.fileNames[0]}`)!;

    let backupCalls = 0;
    const error = await importContentDump(contentDb, systemDb, systemBytes, async () => {
      backupCalls += 1;
    }).catch((err) => err);

    expect(error).toBeInstanceOf(WrongDumpDatabaseError);
    expect((error as Error).message).toContain("aurora-system-backup-");
    expect(backupCalls).toBe(0);
    expect((await contentDb.allDocs()).rows).toHaveLength(0);
  });

  it("a materials dump does NOT merge into the system database — a clear error", async () => {
    const contentDump: ContentDump = {
      header: buildDumpHeader(1),
      docs: [
        {
          _id: "article:test__a",
          _rev: "1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          type: "article",
          title: "A",
        } as unknown as DumpDoc,
      ],
    };

    const error = await restoreSystemDumpParts(systemDb, [encodeDump(contentDump)]).catch((err) => err);

    expect(error).toBeInstanceOf(WrongDumpDatabaseError);
    await expect(systemDb.get("article:test__a")).rejects.toMatchObject({ status: 404 });
  });
});

describe("system database round-trip", () => {
  it("export -> profile loss -> restore: documents match", async () => {
    await fillSystemDb(systemDb);
    const before = await systemDb.allDocs({ include_docs: true });

    const filePort = createFakeFilePort();
    const written = await writeSystemBackup(filePort, systemDb);
    const bytes = filePort.files.get(`backups/${written.fileNames[0]}`)!;

    const restored = freshSystemDb("system-restored-roundtrip");
    try {
      const report = await restoreSystemDumpParts(restored, [bytes]);
      expect(report.merged).toBe(before.rows.length);
      expect(report.created).toBe(before.rows.length);
      expect(report.failures).toEqual([]);

      const after = await restored.allDocs({ include_docs: true });
      const restoredIds = after.rows.map((r) => r.id).filter((id) => before.rows.some((b) => b.id === id));
      expect(restoredIds.sort()).toEqual(before.rows.map((r) => r.id).sort());

      for (const row of before.rows) {
        const original = row.doc as unknown as Record<string, unknown>;
        const copy = (await restored.get(row.id)) as unknown as Record<string, unknown>;
        expect(copy).toEqual(original);
      }
    } finally {
      await restored.destroy().catch(() => undefined);
    }
  });

  it("PASSWORDS are restored: after the restore, signing in works with the same password", async () => {
    const alex = await createUser(systemDb, "Alex", "Alex", "first-pass");
    await changeUserPassword(systemDb, alex._id, "current-pass");

    const filePort = createFakeFilePort();
    const written = await writeSystemBackup(filePort, systemDb);
    const bytes = filePort.files.get(`backups/${written.fileNames[0]}`)!;

    const restored = freshSystemDb("system-restored-login");
    try {
      expect(await verifyLogin(restored, "Alex", "current-pass")).toBeNull();

      await restoreSystemDumpParts(restored, [bytes]);

      const login = await verifyLogin(restored, "Alex", "current-pass");
      expect(login).not.toBeNull();
      expect(login!.user.displayName).toBe("Alex");
      expect(await verifyLogin(restored, "Alex", "first-pass")).toBeNull();
    } finally {
      await restored.destroy().catch(() => undefined);
    }
  });

  it("restoring OVER a live database: the later version of a document wins", async () => {
    const alex = await createUser(systemDb, "Alex", "Alex", "yesterday-pass");
    const filePort = createFakeFilePort();
    const written = await writeSystemBackup(filePort, systemDb);
    const yesterdayBytes = filePort.files.get(`backups/${written.fileNames[0]}`)!;

    await changeUserPassword(systemDb, alex._id, "today-pass");

    const report = await restoreSystemDumpParts(systemDb, [yesterdayBytes]);
    expect(report.updated).toBe(1);

    expect(await verifyLogin(systemDb, "Alex", "today-pass")).not.toBeNull();
  });
});

describe("orchestration through FilePort", () => {
  it('the "Save a copy" button writes to the quiet backups/ folder and logs the event', async () => {
    await fillSystemDb(systemDb);
    const filePort = createFakeFilePort();

    const written = await backupSystemDatabase(filePort, systemDb);

    expect(written.partCount).toBe(1);
    expect([...filePort.files.keys()]).toEqual([`backups/${written.fileNames[0]}`]);
    expect(written.fileNames[0].startsWith(SYSTEM_BACKUP_FILE_PREFIX)).toBe(true);

    const rows = await systemDb.allDocs({ startkey: "applog:", endkey: "applog:￿", include_docs: true });
    expect(rows.rows.some((r) => (r.doc as unknown as { event: string }).event === "system.backup")).toBe(true);
  });

  it("restore from a file via the dialog; cancelling the picker does nothing", async () => {
    await fillSystemDb(systemDb);
    const source = createFakeFilePort();
    const written = await writeSystemBackup(source, systemDb);
    const bytes = source.files.get(`backups/${written.fileNames[0]}`)!;

    const restored = freshSystemDb("system-restored-via-port");
    try {
      const cancelling = createFakeFilePort([]);
      expect(await restoreSystemDatabaseFromFiles(cancelling, restored)).toBeNull();
      expect((await restored.allDocs()).rows).toHaveLength(0);

      const picking = createFakeFilePort(["copy.json"]);
      picking.files.set("copy.json", bytes);
      const report = await restoreSystemDatabaseFromFiles(picking, restored);
      expect(report!.merged).toBeGreaterThan(0);
    } finally {
      await restored.destroy().catch(() => undefined);
    }
  });

  it("a grown system database splits into parts — the code does not break", async () => {
    await fillSystemDb(systemDb);
    const filePort = createFakeFilePort();

    const written = await writeSystemBackup(filePort, systemDb, defaultSystemBackupFileName(), 200);

    expect(written.partCount).toBeGreaterThan(1);
    expect(written.fileNames.some((n) => n.includes(".manifest."))).toBe(true);

    const restored = freshSystemDb("system-restored-multipart");
    try {
      const partBytes = written.fileNames
        .filter((n) => n.includes(".part"))
        .map((n) => filePort.files.get(`backups/${n}`)!);
      const report = await restoreSystemDumpParts(restored, partBytes);
      expect(report.merged).toBe(written.docCount);
    } finally {
      await restored.destroy().catch(() => undefined);
    }
  });
});
