
export type FileHandle = unknown;

export interface SaveFilter {
  label: string;
  extensions: string[];
}

export interface FilePort {
  writeDump(location: FileHandle, data: Uint8Array, mimeType?: string): Promise<void>;

  readDump(handle: FileHandle): Promise<Uint8Array>;

  pickFile(filter?: SaveFilter): Promise<FileHandle | null>;

  pickFiles(): Promise<FileHandle[] | null>;

  pickSaveLocation(suggestedName: string, title: string, filter?: SaveFilter): Promise<FileHandle | null>;

  getAutoBackupLocation(suggestedName: string): Promise<FileHandle>;

  siblingLocation?(location: FileHandle, fileName: string): Promise<FileHandle>;

  fileName?(handle: FileHandle): string | null;
}
