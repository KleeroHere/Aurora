import type { FileHandle, FilePort, SaveFilter } from "./filePort";

interface BrowserSaveHandle {
  kind: "browser-save";
  name: string;
}

function isBrowserSaveHandle(handle: FileHandle): handle is BrowserSaveHandle {
  return (
    typeof handle === "object" &&
    handle !== null &&
    (handle as { kind?: unknown }).kind === "browser-save"
  );
}

export type DownloadTrigger = (blob: Blob, filename: string) => void;

function defaultDownloadTrigger(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type FilePicker = (accept?: string) => Promise<File | null>;
export type FilesPicker = () => Promise<File[] | null>;

export function acceptFromFilter(filter?: SaveFilter): string {
  if (!filter || filter.extensions.length === 0) return "application/json";
  return filter.extensions.map((ext) => `.${ext}`).join(",");
}

function defaultFilePicker(accept = "application/json"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";

    let settled = false;
    function finish(file: File | null) {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    }

    input.addEventListener("cancel", () => finish(null));
    input.addEventListener("change", () => finish(input.files?.[0] ?? null));

    document.body.appendChild(input);
    input.click();
  });
}

function defaultFilesPicker(): Promise<File[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.multiple = true;
    input.style.display = "none";

    let settled = false;
    function finish(files: File[] | null) {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(files);
    }

    input.addEventListener("cancel", () => finish(null));
    input.addEventListener("change", () => {
      const files = input.files ? Array.from(input.files) : [];
      finish(files.length > 0 ? files : null);
    });

    document.body.appendChild(input);
    input.click();
  });
}

export function createBrowserFilePort(
  downloadTrigger: DownloadTrigger = defaultDownloadTrigger,
  filePicker: FilePicker = defaultFilePicker,
  filesPicker: FilesPicker = defaultFilesPicker,
): FilePort {
  return {
    async writeDump(location: FileHandle, data: Uint8Array, mimeType = "application/json"): Promise<void> {
      if (!isBrowserSaveHandle(location)) {
        throw new Error("browserFilePort.writeDump: the handle did not come from pickSaveLocation");
      }
      const blob = new Blob([data], { type: mimeType });
      downloadTrigger(blob, location.name);
    },

    async readDump(handle: FileHandle): Promise<Uint8Array> {
      if (!(handle instanceof File)) {
        throw new Error("browserFilePort.readDump: the handle did not come from pickFile");
      }
      const buffer = await handle.arrayBuffer();
      return new Uint8Array(buffer);
    },

    async pickFile(filter?: SaveFilter): Promise<FileHandle | null> {
      return filePicker(acceptFromFilter(filter));
    },

    async pickFiles(): Promise<FileHandle[] | null> {
      return filesPicker();
    },

    async pickSaveLocation(suggestedName: string): Promise<FileHandle | null> {
      const handle: BrowserSaveHandle = { kind: "browser-save", name: suggestedName };
      return handle;
    },

    async getAutoBackupLocation(suggestedName: string): Promise<FileHandle> {
      const handle: BrowserSaveHandle = { kind: "browser-save", name: suggestedName };
      return handle;
    },

    async siblingLocation(_location: FileHandle, fileName: string): Promise<FileHandle> {
      const handle: BrowserSaveHandle = { kind: "browser-save", name: fileName };
      return handle;
    },

    fileName(handle: FileHandle): string | null {
      if (handle instanceof File) return handle.name;
      if (isBrowserSaveHandle(handle)) return handle.name;
      return null;
    },
  };
}

export const browserFilePort: FilePort = createBrowserFilePort();
