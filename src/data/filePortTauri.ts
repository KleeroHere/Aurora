import { invoke } from "@tauri-apps/api/core";
import type { FileHandle, FilePort, SaveFilter } from "./filePort";
import { uint8ArrayToBase64 } from "./binary";

const WRITE_CHUNK_BYTES = 4 * 1024 * 1024;

export const tauriFilePort: FilePort = {
  async writeDump(location: FileHandle, data: Uint8Array): Promise<void> {
    await invoke("write_dump_begin", { location });
    for (let i = 0; i < data.length; i += WRITE_CHUNK_BYTES) {
      const slice = data.subarray(i, i + WRITE_CHUNK_BYTES);
      await invoke("write_dump_append", { location, chunk: uint8ArrayToBase64(slice) });
    }
  },

  async readDump(handle: FileHandle): Promise<Uint8Array> {
    const buffer = await invoke<ArrayBuffer>("read_dump", { handle });
    return new Uint8Array(buffer);
  },

  async pickFile(filter?: SaveFilter): Promise<FileHandle | null> {
    return await invoke<string | null>("pick_file", { filter: filter ?? null });
  },

  async pickFiles(): Promise<FileHandle[] | null> {
    return await invoke<string[] | null>("pick_files");
  },

  async pickSaveLocation(suggestedName: string, title: string, filter?: SaveFilter): Promise<FileHandle | null> {
    return await invoke<string | null>("pick_save_location", { suggestedName, title, filter: filter ?? null });
  },

  async getAutoBackupLocation(suggestedName: string): Promise<FileHandle> {
    return await invoke<string>("resolve_backup_path", { suggestedName });
  },

  async siblingLocation(location: FileHandle, fileName: string): Promise<FileHandle> {
    if (typeof location !== "string") {
      throw new Error("tauriFilePort.siblingLocation: the handle did not come from pickSaveLocation");
    }
    return location.replace(/[^\\/]*$/, fileName);
  },

  fileName(handle: FileHandle): string | null {
    if (typeof handle !== "string") return null;
    const match = /[^\\/]*$/.exec(handle);
    return match && match[0] ? match[0] : null;
  },
};
