import { uint8ArrayToBase64 } from "./binary";
import type { Card, FileExt, MaterialFile } from "./types";

export const MAX_FILE_MATERIAL_BYTES = 50 * 1024 * 1024;

export const ALLOWED_ORIGINAL_EXTS: readonly FileExt[] = ["pdf", "doc", "docx", "xlsx", "ppt", "pptx"];

const CONTENT_TYPES: Record<FileExt, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function contentTypeForExt(ext: FileExt): string {
  return CONTENT_TYPES[ext];
}

export function extFromFileName(name: string): FileExt | null {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  return (ALLOWED_ORIGINAL_EXTS as readonly string[]).includes(ext) ? (ext as FileExt) : null;
}

export function looksLikePdf(bytes: Uint8Array): boolean {
  const window = bytes.subarray(0, 1024);
  const signature = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  outer: for (let i = 0; i + signature.length <= window.length; i += 1) {
    for (let k = 0; k < signature.length; k += 1) {
      if (window[i + k] !== signature[k]) continue outer;
    }
    return true;
  }
  return false;
}

export class FileMaterialInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileMaterialInputError";
  }
}

export interface PickedFile {
  name: string;
  bytes: Uint8Array;
}

export interface FileMaterialDraftInput {
  pdf: PickedFile;
  original?: PickedFile | null;
  coverPng?: Uint8Array | null;
}

export interface FileMaterialDraft {
  file: MaterialFile;
  attachments: PouchDB.Core.Attachments;
  cover: Card["cover"];
}

function checkSize(picked: PickedFile): void {
  if (picked.bytes.length === 0) {
    throw new FileMaterialInputError(`The file "${picked.name}" is empty - it contains zero bytes.`);
  }
  if (picked.bytes.length > MAX_FILE_MATERIAL_BYTES) {
    const mb = Math.round(picked.bytes.length / (1024 * 1024));
    const limit = Math.round(MAX_FILE_MATERIAL_BYTES / (1024 * 1024));
    throw new FileMaterialInputError(
      `The file "${picked.name}" weighs ${mb} MB, and files over ${limit} MB cannot go into the database: ` +
        `with such an attachment the backup copy will stop opening. Compress the file or split it into parts.`,
    );
  }
}

export function buildFileMaterialDraft(input: FileMaterialDraftInput): FileMaterialDraft {
  const { pdf, original, coverPng } = input;

  checkSize(pdf);
  if (!looksLikePdf(pdf.bytes)) {
    throw new FileMaterialInputError(
      `The file "${pdf.name}" does not look like a PDF inside. Check that you picked an actual PDF, not a renamed document.`,
    );
  }

  const attachments: PouchDB.Core.Attachments = {
    pdf: { content_type: CONTENT_TYPES.pdf, data: uint8ArrayToBase64(pdf.bytes) },
  } as PouchDB.Core.Attachments;

  let originalRecord: MaterialFile["original"];

  if (original) {
    checkSize(original);
    const ext = extFromFileName(original.name);
    if (!ext) {
      throw new FileMaterialInputError(
        `The file "${original.name}" has a type the app does not store. Accepted types: ${ALLOWED_ORIGINAL_EXTS.join(", ")}.`,
      );
    }
    (attachments as Record<string, unknown>).original = {
      content_type: CONTENT_TYPES[ext],
      data: uint8ArrayToBase64(original.bytes),
    };
    originalRecord = {
      attachment: "original",
      name: original.name,
      ext,
      size: original.bytes.length,
    };
  } else {
    originalRecord = {
      attachment: "pdf",
      name: pdf.name,
      ext: "pdf",
      size: pdf.bytes.length,
    };
  }

  let cover: Card["cover"] = null;
  if (coverPng && coverPng.length > 0) {
    (attachments as Record<string, unknown>).cover = {
      content_type: "image/png",
      data: uint8ArrayToBase64(coverPng),
    };
    cover = { attachment: "cover" };
  }

  return {
    file: {
      original: originalRecord,
      pdf: { attachment: "pdf", size: pdf.bytes.length },
    },
    attachments,
    cover,
  };
}
