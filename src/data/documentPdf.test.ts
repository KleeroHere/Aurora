import { describe, expect, it } from "vitest";
// The legacy build is the one pdf.js supports under Node; the app itself uses
// the browser build via src/data/pdf.ts — same engine, same parser.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createDocumentPdf, type PdfFormSpec, type PdfSlidesSpec } from "./documentPdf";

async function openPdf(bytes: Uint8Array) {
  const task = getDocument({
    data: bytes.slice(), // pdf.js transfers the buffer; keep the caller's copy intact
    standardFontDataUrl: new URL("../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url)
      .href,
    verbosity: 0,
  });
  const document = await task.promise;
  return { document, destroy: () => task.destroy() };
}

async function pageText(document: Awaited<ReturnType<typeof openPdf>>["document"], pageNumber: number) {
  const page = await document.getPage(pageNumber);
  const content = await page.getTextContent();
  return content.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ");
}

const shiftForm: PdfFormSpec = {
  kind: "form",
  title: "Shift Handover Form",
  subtitle: "Keep in the shift folder",
  intro: ["Fill in at the end of every shift before the incoming consultant arrives."],
  fields: [
    { label: "Consultant on duty" },
    { label: "Notable events during the shift", lines: 3 },
  ],
  checkboxes: ["Medication log reviewed", "Diaries collected"],
  table: { headers: ["Time", "Resident", "Note"], rows: 4 },
  signatures: ["Consultant on duty", "Shift lead"],
  footer: "Aurora Recovery Center - internal document",
};

const teamSlides: PdfSlidesSpec = {
  kind: "slides",
  title: "Working With Newcomers",
  subtitle: "Staff orientation deck",
  slides: [
    {
      heading: "First 24 hours",
      bullets: ["Assign a buddy from the senior group", "Walk through the daily schedule"],
    },
    {
      heading: "Common pitfalls",
      bullets: ["Do not leave the newcomer alone during meals", "Escalate conflicts to the shift lead"],
    },
  ],
  footer: "Aurora Recovery Center",
};

describe("createDocumentPdf", () => {
  it("produces a form that pdf.js opens, with title and field labels in the text layer", async () => {
    const { document, destroy } = await openPdf(createDocumentPdf(shiftForm));
    try {
      expect(document.numPages).toBeGreaterThanOrEqual(1);
      const text = await pageText(document, 1);
      expect(text).toContain("Shift Handover Form");
      expect(text).toContain("Consultant on duty");
      expect(text).toContain("Keep in the shift folder");
      expect(text).toContain("Medication log reviewed");
      expect(text).toContain("signature / date");
      expect(text).toContain("Page 1 of");
    } finally {
      await destroy();
    }
  });

  it("flows an oversized form onto continuation pages with page numbers", async () => {
    const bigForm: PdfFormSpec = {
      kind: "form",
      title: "Weekly Observation Log",
      fields: Array.from({ length: 20 }, (_, i) => ({
        label: `Observation entry ${i + 1}`,
        lines: 2,
      })),
      table: { headers: ["Day", "Rating", "Comment"], rows: 10 },
      signatures: ["Program director"],
      footer: "Internal use only",
    };
    const { document, destroy } = await openPdf(createDocumentPdf(bigForm));
    try {
      expect(document.numPages).toBeGreaterThanOrEqual(2);
      const lastPage = await pageText(document, document.numPages);
      expect(lastPage).toContain(`Page ${document.numPages} of ${document.numPages}`);
      // Continuation pages repeat the document title in the running header.
      const secondPage = await pageText(document, 2);
      expect(secondPage).toContain("Weekly Observation Log");
    } finally {
      await destroy();
    }
  });

  it("produces a slide deck with a title page plus one page per slide", async () => {
    const { document, destroy } = await openPdf(createDocumentPdf(teamSlides));
    try {
      expect(document.numPages).toBe(1 + teamSlides.slides.length);
      const titlePage = await pageText(document, 1);
      expect(titlePage).toContain("Working With Newcomers");
      expect(titlePage).toContain("Staff orientation deck");
      const firstSlide = await pageText(document, 2);
      expect(firstSlide).toContain("First 24 hours");
      expect(firstSlide).toContain("Assign a buddy from the senior group");
      expect(firstSlide).toContain("1 / 2");
    } finally {
      await destroy();
    }
  });

  it("folds non-ASCII input to clean ASCII instead of breaking the text layer", async () => {
    const spec: PdfFormSpec = {
      kind: "form",
      title: "Rules — living area “quiet hours”",
      fields: [{ label: "Résumé of the day – notes…" }],
    };
    const { document, destroy } = await openPdf(createDocumentPdf(spec));
    try {
      const text = await pageText(document, 1);
      expect(text).toContain('Rules - living area "quiet hours"');
      expect(text).toContain("Resume of the day - notes...");
      expect(text).not.toMatch(/[–—“”…é]/);
    } finally {
      await destroy();
    }
  });

  it("splits a long table across pages, repeating the header row", async () => {
    const spec: PdfFormSpec = {
      kind: "form",
      title: "Medication Schedule",
      table: { headers: ["Time", "Resident", "Medication", "Given by"], rows: 40 },
    };
    const { document, destroy } = await openPdf(createDocumentPdf(spec));
    try {
      expect(document.numPages).toBeGreaterThanOrEqual(2);
      const secondPage = await pageText(document, 2);
      expect(secondPage).toContain("Resident"); // header repeated on the next segment
    } finally {
      await destroy();
    }
  });
});
