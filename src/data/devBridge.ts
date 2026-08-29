import type { FileHandle, FilePort } from "./filePort";
import { exportDatabaseToFiles, importDatabaseFromFiles } from "./sync";
import type { ExportFilesResult, ImportProgress, ImportReport } from "./sync";
import { exportSeedBundle } from "./seedExport";
import type { SeedExportResult } from "./seedExport";

export interface DevBridge {
  contentDb: PouchDB.Database;
  systemDb: PouchDB.Database;
  filePort: FilePort;
  importBundle(paths: string[], onProgress?: (p: ImportProgress) => void): Promise<ImportReport | null>;
  exportDatabase(location: string, maxPartBytes?: number): Promise<ExportFilesResult | null>;
  exportSeed(): Promise<SeedExportResult>;
  queuePickedFiles(handles: FileHandle[]): void;
}

declare global {
  // eslint-disable-next-line no-var
  var __auroraDev: DevBridge | undefined;
}

export function installDevBridge(deps: {
  contentDb: PouchDB.Database;
  systemDb: PouchDB.Database;
  filePort: FilePort;
}): void {
  if (!import.meta.env.DEV) return;

  const { contentDb, systemDb, filePort } = deps;

  const pickQueue: FileHandle[] = [];
  const realPickFile = filePort.pickFile.bind(filePort);
  filePort.pickFile = async (filter) => (pickQueue.length > 0 ? pickQueue.shift()! : realPickFile(filter));

  globalThis.__auroraDev = {
    contentDb,
    systemDb,
    filePort,
    async importBundle(paths, onProgress) {
      if (!Array.isArray(paths) || paths.length === 0) {
        throw new Error("importBundle: a non-empty list of bundle file paths is required");
      }
      const portWithFixedSelection: FilePort = {
        ...filePort,
        async pickFiles() {
          return paths;
        },
      };
      return await importDatabaseFromFiles(portWithFixedSelection, contentDb, systemDb, onProgress);
    },
    async exportDatabase(location, maxPartBytes) {
      if (typeof location !== "string" || location.length === 0) {
        throw new Error("exportDatabase: an absolute path to the first file is required");
      }
      const dir = location.replace(/[\\/][^\\/]*$/, "");
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("dev_allow_dir", { dir });
      } catch {
      }
      const portWithFixedLocation: FilePort = {
        ...filePort,
        async pickSaveLocation(): Promise<FileHandle | null> {
          return location;
        },
      };
      return maxPartBytes === undefined
        ? await exportDatabaseToFiles(portWithFixedLocation, contentDb, systemDb)
        : await exportDatabaseToFiles(portWithFixedLocation, contentDb, systemDb, maxPartBytes);
    },
    async exportSeed() {
      return await exportSeedBundle(filePort, contentDb, systemDb);
    },
    queuePickedFiles(handles) {
      if (!Array.isArray(handles)) throw new Error("queuePickedFiles: a list of paths is required");
      pickQueue.push(...handles);
      const paths = handles.filter((handle): handle is string => typeof handle === "string");
      if (paths.length === 0) return;
      void (async () => {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          for (const path of paths) {
            await invoke("dev_allow_dir", { dir: path.replace(/[\\/][^\\/]*$/, "") });
          }
        } catch {
        }
      })();
    },
  };

  console.info(
    `[devBridge] window.__auroraDev is ready (${Object.keys(globalThis.__auroraDev).length} members). ` +
      "Dev build only; this code is absent from the release build.",
  );
}
