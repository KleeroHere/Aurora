import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FilePort } from "./filePort";

const importDatabaseFromFiles = vi.hoisted(() => vi.fn());
const exportDatabaseToFiles = vi.hoisted(() => vi.fn());
vi.mock("./sync", () => ({ importDatabaseFromFiles, exportDatabaseToFiles }));

const exportSeedBundle = vi.hoisted(() => vi.fn());
vi.mock("./seedExport", () => ({ exportSeedBundle }));

const fakeContentDb = { name: "content" } as unknown as PouchDB.Database;
const fakeSystemDb = { name: "system" } as unknown as PouchDB.Database;

function makeFilePort(): FilePort {
  return {
    writeDump: vi.fn(async () => undefined),
    readDump: vi.fn(async () => new Uint8Array([1, 2, 3])),
    pickFile: vi.fn(async () => "file-picked-by-dialog"),
    pickFiles: vi.fn(async () => ["file-picked-by-dialog"]),
    pickSaveLocation: vi.fn(async () => "location-picked-by-dialog"),
    getAutoBackupLocation: vi.fn(async () => "backups/auto-backup.json"),
  } as unknown as FilePort;
}

describe("installDevBridge", () => {
  let filePort: FilePort;

  beforeEach(async () => {
    importDatabaseFromFiles.mockReset();
    importDatabaseFromFiles.mockResolvedValue({ merged: 0, created: 0, updated: 0, conflictsResolved: 0, resolutions: [] });
    exportDatabaseToFiles.mockReset();
    exportDatabaseToFiles.mockResolvedValue({ docCount: 0, byteSize: 0, partCount: 1, fileNames: [] });
    exportSeedBundle.mockReset();
    exportSeedBundle.mockResolvedValue({ docCount: 0, parts: 1, baseName: "aurora-seed-export.json" });
    delete globalThis.__auroraDev;
    filePort = makeFilePort();
    const { installDevBridge } = await import("./devBridge");
    installDevBridge({ contentDb: fakeContentDb, systemDb: fakeSystemDb, filePort });
  });

  it("installs the bridge on globalThis with the app databases and file port", () => {
    expect(globalThis.__auroraDev).toBeDefined();
    expect(globalThis.__auroraDev?.contentDb).toBe(fakeContentDb);
    expect(globalThis.__auroraDev?.systemDb).toBe(fakeSystemDb);
  });

  it("import goes through the production importDatabaseFromFiles with the same databases", async () => {
    await globalThis.__auroraDev!.importBundle(["a.json", "b.json"]);
    expect(importDatabaseFromFiles).toHaveBeenCalledTimes(1);
    const [, contentDb, systemDb] = importDatabaseFromFiles.mock.calls[0];
    expect(contentDb).toBe(fakeContentDb);
    expect(systemDb).toBe(fakeSystemDb);
  });

  it("overrides ONLY pickFiles - the other port methods stay real", async () => {
    await globalThis.__auroraDev!.importBundle(["part1.json", "part2.json"]);
    const [port] = importDatabaseFromFiles.mock.calls[0] as [FilePort];

    await expect(port.pickFiles()).resolves.toEqual(["part1.json", "part2.json"]);
    expect(filePort.pickFiles).not.toHaveBeenCalled();

    await expect(port.getAutoBackupLocation("x.json")).resolves.toBe("backups/auto-backup.json");
    expect(filePort.getAutoBackupLocation).toHaveBeenCalledWith("x.json");
    await port.writeDump("target", new Uint8Array([9]));
    expect(filePort.writeDump).toHaveBeenCalledWith("target", new Uint8Array([9]));
  });

  it("an empty path list is an error, not a silent import of \"nothing\"", async () => {
    await expect(globalThis.__auroraDev!.importBundle([])).rejects.toThrow(/non-empty list/);
    expect(importDatabaseFromFiles).not.toHaveBeenCalled();
  });

  it("export goes through the production exportDatabaseToFiles with the same databases", async () => {
    await globalThis.__auroraDev!.exportDatabase("C:/target/aurora-dump.json");
    expect(exportDatabaseToFiles).toHaveBeenCalledTimes(1);
    const [, contentDb, systemDb] = exportDatabaseToFiles.mock.calls[0];
    expect(contentDb).toBe(fakeContentDb);
    expect(systemDb).toBe(fakeSystemDb);
  });

  it("export overrides ONLY pickSaveLocation - writing and \"nearby\" stay real", async () => {
    await globalThis.__auroraDev!.exportDatabase("C:/target/aurora-dump.json");
    const [port] = exportDatabaseToFiles.mock.calls[0] as [FilePort];

    await expect(port.pickSaveLocation("any", "any")).resolves.toBe("C:/target/aurora-dump.json");
    expect(filePort.pickSaveLocation).not.toHaveBeenCalled();

    await port.writeDump("target", new Uint8Array([7]));
    expect(filePort.writeDump).toHaveBeenCalledWith("target", new Uint8Array([7]));
  });

  it("export without a path is an error, not a write to who-knows-where", async () => {
    await expect(globalThis.__auroraDev!.exportDatabase("")).rejects.toThrow(/absolute path/);
    expect(exportDatabaseToFiles).not.toHaveBeenCalled();
  });

  it("seed export goes through the production exportSeedBundle with the UNmodified port", async () => {
    await globalThis.__auroraDev!.exportSeed();
    expect(exportSeedBundle).toHaveBeenCalledTimes(1);
    const [port, contentDb, systemDb] = exportSeedBundle.mock.calls[0];
    expect(port).toBe(filePort);
    expect(contentDb).toBe(fakeContentDb);
    expect(systemDb).toBe(fakeSystemDb);
  });

  describe("queuePickedFiles", () => {
    it("hands out queued paths one at a time in the order they were queued", async () => {
      globalThis.__auroraDev!.queuePickedFiles(["C:/files/survey.pdf", "C:/files/survey.docx"]);

      await expect(filePort.pickFile()).resolves.toBe("C:/files/survey.pdf");
      await expect(filePort.pickFile()).resolves.toBe("C:/files/survey.docx");
    });

    it("a drained queue falls back to the dialog - the app is not left broken", async () => {
      globalThis.__auroraDev!.queuePickedFiles(["C:/files/survey.pdf"]);
      await filePort.pickFile();

      await expect(filePort.pickFile()).resolves.toBe("file-picked-by-dialog");
    });

    it("without touching the bridge, file picking remains a real dialog", async () => {
      await expect(filePort.pickFile()).resolves.toBe("file-picked-by-dialog");
    });

    it("not a list is an error, not silent nothing", () => {
      expect(() => globalThis.__auroraDev!.queuePickedFiles("file" as unknown as string[])).toThrow(
        /list of paths/,
      );
    });
  });
});
