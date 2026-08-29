import { describe, expect, it } from "vitest";
import { createPlaceholderPdf } from "./binary";
import {
  ALLOWED_ORIGINAL_EXTS,
  FileMaterialInputError,
  MAX_FILE_MATERIAL_BYTES,
  buildFileMaterialDraft,
  contentTypeForExt,
  extFromFileName,
  looksLikePdf,
} from "./fileMaterialDraft";

const PDF = createPlaceholderPdf("Blank");

function pickedPdf(name = "Survey.pdf") {
  return { name, bytes: PDF };
}

describe("file recognition", () => {
  it("a real PDF is recognized by its signature, not its name", () => {
    expect(looksLikePdf(PDF)).toBe(true);
  });

  it("a document renamed to .pdf does not pass", () => {
    expect(looksLikePdf(new TextEncoder().encode("PKplain docx"))).toBe(false);
  });

  it("junk before the header is allowed - some programs write files that way", () => {
    const withPreamble = new Uint8Array(PDF.length + 5);
    withPreamble.set([0x0d, 0x0a, 0x0d, 0x0a, 0x20], 0);
    withPreamble.set(PDF, 5);
    expect(looksLikePdf(withPreamble)).toBe(true);
  });

  it("an empty file is not a PDF", () => {
    expect(looksLikePdf(new Uint8Array(0))).toBe(false);
  });

  it("the extension is taken from the name and lowercased", () => {
    expect(extFromFileName("Form.DOCX")).toBe("docx");
    expect(extFromFileName("file.with.dots.pptx")).toBe("pptx");
  });

  it("foreign types do not pass: the app will neither show nor print them", () => {
    expect(extFromFileName("archive.zip")).toBeNull();
    expect(extFromFileName("picture.png")).toBeNull();
    expect(extFromFileName("noextension")).toBeNull();
    expect(extFromFileName("dot.")).toBeNull();
  });

  it("every allowed extension has a MIME type - otherwise the attachment will not open", () => {
    for (const ext of ALLOWED_ORIGINAL_EXTS) {
      expect(contentTypeForExt(ext)).toMatch(/\//);
    }
  });
});

describe("PDF only", () => {
  it("a single attachment, with original pointing at it - bytes are not duplicated", () => {
    const draft = buildFileMaterialDraft({ pdf: pickedPdf("Consent.pdf") });

    expect(Object.keys(draft.attachments)).toEqual(["pdf"]);
    expect(draft.file.pdf.attachment).toBe("pdf");
    expect(draft.file.original.attachment).toBe("pdf");
    expect(draft.file.original.name).toBe("Consent.pdf");
    expect(draft.file.original.ext).toBe("pdf");
  });

  it("the size is real, from the bytes, not zero (closing P3-5 - same as migration)", () => {
    const draft = buildFileMaterialDraft({ pdf: pickedPdf() });
    expect(draft.file.pdf.size).toBe(PDF.length);
    expect(draft.file.original.size).toBe(PDF.length);
  });

  it("without a cover, card.cover stays null - that is allowed, not an error", () => {
    const draft = buildFileMaterialDraft({ pdf: pickedPdf() });
    expect(draft.cover).toBeNull();
  });
});

describe("source file + PDF pair", () => {
  const original = { name: "Survey.docx", bytes: new TextEncoder().encode("PKdocx") };

  it("two attachments, each under its own key", () => {
    const draft = buildFileMaterialDraft({ pdf: pickedPdf(), original });

    expect(Object.keys(draft.attachments).sort()).toEqual(["original", "pdf"]);
    expect(draft.file.original.attachment).toBe("original");
    expect(draft.file.original.ext).toBe("docx");
    expect(draft.file.pdf.attachment).toBe("pdf");
  });

  it("the original name is kept - the file will download under it", () => {
    const draft = buildFileMaterialDraft({ pdf: pickedPdf(), original });
    expect(draft.file.original.name).toBe("Survey.docx");
  });

  it("the original's content_type is its own, not PDF", () => {
    const draft = buildFileMaterialDraft({ pdf: pickedPdf(), original });
    const attachments = draft.attachments as Record<string, { content_type: string }>;
    expect(attachments.original.content_type).toContain("wordprocessingml");
    expect(attachments.pdf.content_type).toBe("application/pdf");
  });
});

describe("cover", () => {
  it("attached as a separate attachment and lands in card.cover - same as migration", () => {
    const draft = buildFileMaterialDraft({ pdf: pickedPdf(), coverPng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) });

    expect(draft.cover).toEqual({ attachment: "cover" });
    expect(Object.keys(draft.attachments).sort()).toEqual(["cover", "pdf"]);
  });

  it("an empty picture is the same as no picture", () => {
    const draft = buildFileMaterialDraft({ pdf: pickedPdf(), coverPng: new Uint8Array(0) });
    expect(draft.cover).toBeNull();
    expect(Object.keys(draft.attachments)).toEqual(["pdf"]);
  });
});

describe("rejections", () => {
  it("a non-PDF posing as a PDF is rejected with an explanation", () => {
    expect(() => buildFileMaterialDraft({ pdf: { name: "Form.pdf", bytes: new TextEncoder().encode("not a pdf at all") } }))
      .toThrow(FileMaterialInputError);
  });

  it("an empty file is rejected", () => {
    expect(() => buildFileMaterialDraft({ pdf: { name: "Empty.pdf", bytes: new Uint8Array(0) } })).toThrow(
      /empty/,
    );
  });

  it("a file that is too large is rejected - otherwise the database backup will stop opening", () => {
    const huge = new Uint8Array(MAX_FILE_MATERIAL_BYTES + 1);
    huge.set(PDF, 0);
    expect(() => buildFileMaterialDraft({ pdf: { name: "Huge.pdf", bytes: huge } })).toThrow(/MB/);
  });

  it("a source file of a foreign type is rejected, with the accepted types listed in the text", () => {
    expect(() =>
      buildFileMaterialDraft({
        pdf: pickedPdf(),
        original: { name: "archive.zip", bytes: new Uint8Array([1, 2, 3]) },
      }),
    ).toThrow(/docx/);
  });

  it("rejection texts are human-readable and free of technical jargon", () => {
    try {
      buildFileMaterialDraft({ pdf: { name: "Form.pdf", bytes: new TextEncoder().encode("nope") } });
      expect.unreachable("should have thrown");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch(/[a-z]/i);
      expect(message).not.toMatch(/undefined|null|Error:|throw/);
    }
  });
});
