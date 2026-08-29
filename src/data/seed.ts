import { buildMigratedMaterialId, buildSectionId, slugify, transliterate } from "./slug";
import { computeArticleDerivedFields, computeFileDerivedFields, computeFilmDerivedFields } from "./derived";
import { createPlaceholderPdf, uint8ArrayToBase64 } from "./binary";
import { createDocumentPdf } from "./documentPdf";
import { readPdfIntake } from "./pdfIntake";
import { buildOutputData, seedMaterials, seedSections } from "./seedData";
import { SEED_DOCUMENTS } from "./seedDocuments";
import { SCHEMA_VERSION } from "./types";
import type { Article, Film, FormDoc, Material, Presentation, Section } from "./types";

const SEED_TIMESTAMP = "2026-07-26T00:00:00.000Z";

async function docExists(db: PouchDB.Database, id: string): Promise<boolean> {
  try {
    await db.get(id);
    return true;
  } catch (err) {
    if ((err as PouchDB.Core.Error).status === 404) return false;
    throw err;
  }
}

function primaryTagFor(sectionSlug: string): string {
  const section = seedSections.find((s) => s.slug === sectionSlug);
  return section?.primaryTag ?? sectionSlug;
}

export interface SeedResult {
  sectionsCreated: number;
  materialsCreated: number;
}

export async function seedContentIfNeeded(contentDb: PouchDB.Database): Promise<SeedResult> {
  let sectionsCreated = 0;
  let materialsCreated = 0;

  for (const spec of seedSections) {
    const _id = buildSectionId(spec.slug);
    if (await docExists(contentDb, _id)) continue;

    const doc: Section = {
      _id,
      type: "section",
      schemaVersion: SCHEMA_VERSION,
      title: spec.title,
      slug: spec.slug,
      description: spec.description,
      macroCategory: spec.macroCategory,
      parentId: spec.parentSlug ? buildSectionId(spec.parentSlug) : null,
      layout: spec.layout,
      order: spec.order,
      cover: null,
      primaryTag: spec.primaryTag,
      legacy: { sourcePaths: [] },
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    };
    await contentDb.put(doc);
    sectionsCreated++;
  }

  for (const spec of seedMaterials) {
    const nameSlug = slugify(spec.nameSlugSource);
    const _id = buildMigratedMaterialId(spec.type, spec.sectionSlug, nameSlug);
    if (await docExists(contentDb, _id)) continue;

    const envelopeBase = {
      _id,
      schemaVersion: SCHEMA_VERSION,
      title: spec.title,
      sectionId: buildSectionId(spec.sectionSlug),
      // The section tag always stays on the material so section filters keep
      // working; anything the material declares itself comes first.
      tags: Array.from(new Set([...(spec.tags ?? []), primaryTagFor(spec.sectionSlug)])),
      card: { color: spec.cardColor, cover: null },
      order: spec.order,
      createdBy: "migration",
      createdAt: SEED_TIMESTAMP,
      updatedBy: "migration",
      updatedAt: SEED_TIMESTAMP,
      legacy: null,
    };

    let doc: Material;

    if (spec.type === "article") {
      const body = buildOutputData(spec.blocks);
      const derivedFields = computeArticleDerivedFields(body);
      // Inline diagrams ship as SVG attachments; image blocks in the body
      // reference them by attachment key, exactly as the editor would.
      const figureAttachments =
        spec.figures && Object.keys(spec.figures).length > 0
          ? {
              _attachments: Object.fromEntries(
                Object.entries(spec.figures).map(([key, svg]) => [
                  key,
                  {
                    content_type: "image/svg+xml",
                    data: uint8ArrayToBase64(new TextEncoder().encode(svg)),
                  },
                ]),
              ),
            }
          : {};
      doc = {
        ...envelopeBase,
        type: "article",
        body,
        ...derivedFields,
        ...(spec.video ? { video: spec.video } : {}),
        ...figureAttachments,
      } satisfies Article;
    } else if (spec.type === "film") {
      const intro = buildOutputData(spec.introBlocks);
      const questions = buildOutputData(spec.questionsBlocks);
      const derivedFields = computeFilmDerivedFields(intro, questions);
      doc = {
        ...envelopeBase,
        type: "film",
        intro,
        questions,
        video: spec.video ?? null,
        ...derivedFields,
      } satisfies Film;
    } else {
      // The wording of the form goes into the PDF and into the search index:
      // in this product a blank is findable by the words printed on it. Each
      // seeded file gets a properly laid-out multi-page document; the plain
      // fallback only fires for a material added without a layout.
      const lines = spec.fileLines ?? [];
      const documentSpec = SEED_DOCUMENTS[spec.nameSlugSource];
      const pdfBytes = documentSpec
        ? createDocumentPdf(documentSpec)
        : createPlaceholderPdf(
            transliterate(spec.title).slice(0, 60) || "placeholder",
            lines.map((line) => transliterate(line).slice(0, 78)),
          );
      const pdfBase64 = uint8ArrayToBase64(pdfBytes);

      // Run the same intake pipeline a user-uploaded file goes through: the
      // first page becomes the card cover, the text layer feeds the search
      // index. Best-effort — in environments without canvas (tests) the demo
      // simply seeds without covers.
      let coverPng: Uint8Array | null = null;
      let extractedText = "";
      try {
        const intake = await readPdfIntake(pdfBytes);
        coverPng = intake.coverPng;
        extractedText = intake.text;
      } catch {
        /* no canvas / no worker — covers are cosmetic */
      }

      const searchText =
        extractedText.trim().length > 0
          ? extractedText
          : lines.length > 0
            ? [spec.title, ...lines].join("\n")
            : undefined;
      const derivedFields = computeFileDerivedFields(spec.title, searchText);
      const originalName = `${spec.title}.${spec.fileExt}`;

      const fileDoc = {
        ...envelopeBase,
        ...(coverPng ? { card: { color: spec.cardColor, cover: { attachment: "cover" } } } : {}),
        type: spec.type,
        file: {
          original: {
            attachment: "original",
            name: originalName,
            ext: spec.fileExt,
            size: spec.fileSizeOriginal,
          },
          pdf: { attachment: "pdf", size: pdfBytes.length },
        },
        ...derivedFields,
        _attachments: {
          original: { content_type: "application/pdf", data: pdfBase64 },
          pdf: { content_type: "application/pdf", data: pdfBase64 },
          ...(coverPng ? { cover: { content_type: "image/png", data: uint8ArrayToBase64(coverPng) } } : {}),
        },
      };
      doc = fileDoc as unknown as FormDoc | Presentation;
    }

    await contentDb.put(doc);
    materialsCreated++;
  }

  return { sectionsCreated, materialsCreated };
}
