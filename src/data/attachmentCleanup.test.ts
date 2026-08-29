import { describe, expect, it } from "vitest";
import {
  PROTECTED_ATTACHMENT_KEYS,
  collectReferencedAttachmentKeys,
  computeOrphanedAttachmentKeys,
} from "./attachmentCleanup";
import type { EditorJsOutputData } from "./types";

function body(blocks: EditorJsOutputData["blocks"]): EditorJsOutputData {
  return { time: 1, blocks, version: "2.31.6" };
}

describe("collectReferencedAttachmentKeys", () => {
  it("collects keys from image and attaches blocks", () => {
    const data = body([
      { type: "paragraph", data: { text: "text" } },
      { type: "image", data: { file: { key: "img-1" }, caption: "" } },
      { type: "attaches", data: { file: { key: "file-1", name: "a.pdf", ext: "pdf", size: 1 }, title: "" } },
    ]);
    expect(collectReferencedAttachmentKeys(data)).toEqual(new Set(["img-1", "file-1"]));
  });

  it("merges keys from multiple bodies (film: intro + questions)", () => {
    const intro = body([{ type: "image", data: { file: { key: "img-intro" }, caption: "" } }]);
    const questions = body([{ type: "image", data: { file: { key: "img-questions" }, caption: "" } }]);
    expect(collectReferencedAttachmentKeys(intro, questions)).toEqual(new Set(["img-intro", "img-questions"]));
  });

  it("empty body -> empty set", () => {
    expect(collectReferencedAttachmentKeys(body([]))).toEqual(new Set());
  });

  it("ignores undefined bodies", () => {
    expect(collectReferencedAttachmentKeys(undefined, body([]))).toEqual(new Set());
  });
});

describe("computeOrphanedAttachmentKeys", () => {
  it("attachment not referenced in the body is an orphan", () => {
    const orphans = computeOrphanedAttachmentKeys(["img-1", "img-2"], new Set(["img-1"]));
    expect(orphans).toEqual(["img-2"]);
  });

  it("protected names (original/pdf/cover) are never orphans, even without references", () => {
    const orphans = computeOrphanedAttachmentKeys(["original", "pdf", "cover"], new Set());
    expect(orphans).toEqual([]);
  });

  it("no extra attachments -> empty list", () => {
    expect(computeOrphanedAttachmentKeys(["img-1"], new Set(["img-1"]))).toEqual([]);
  });

  it("PROTECTED_ATTACHMENT_KEYS is exactly original/pdf/cover", () => {
    expect(PROTECTED_ATTACHMENT_KEYS).toEqual(["original", "pdf", "cover"]);
  });
});
