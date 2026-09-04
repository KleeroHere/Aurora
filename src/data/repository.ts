import packageJson from "../../package.json";
import { ensureContentIndexes, ensureSystemIndexes } from "./db";
import { seedContentIfNeeded } from "./seed";
import { createChangeBus } from "./changesBus";
import type { RepoChangeEvent } from "./changesBus";
import { pulseWriting, pulseError, clearSyncError } from "./syncStatusBus";
import { createMaterialSearchIndex } from "./searchIndex";
import type { MaterialSearchIndex, SearchHit } from "./searchIndex";
import { loadSynonyms } from "./synonyms";
import { ulid } from "./ulid";
import { buildAppMaterialId, buildSectionId, sectionSlugFromId, slugify } from "./slug";
import {
  computeArticleDerivedFields,
  computeFileDerivedFields,
  computeFilmDerivedFields,
} from "./derived";
import { compareMaterials } from "./sortMaterials";
import { collectReferencedAttachmentKeys, computeOrphanedAttachmentKeys } from "./attachmentCleanup";
import { isSafeVideoPath, normalizeVideo } from "./videoPort";
import { SCHEMA_VERSION } from "./types";
import type {
  AppLog,
  Card,
  Change,
  EditorJsOutputData,
  MacroCategory,
  Material,
  MaterialFile,
  MaterialSummary,
  MaterialType,
  MaterialVideo,
  Section,
} from "./types";
import {
  exportDatabaseToFiles,
  importDatabaseFromFiles,
} from "./sync";
import type { ExportFilesResult, ImportProgress, ImportReport } from "./sync";
import type { WrittenDump } from "./dumpStream";
import { backupSystemDatabase, restoreSystemDatabaseFromFiles } from "./systemBackup";
import type { SystemRestoreReport } from "./systemBackup";
import { exportSeedBundle } from "./seedExport";
import type { SeedExportResult } from "./seedExport";
import type { FilePort, SaveFilter } from "./filePort";
import {
  buildUserDisplayNames,
  changeUserPassword,
  createUser as createUserInSystemDb,
  listUsers as listUsersFromSystemDb,
  migrateUserIdsToUlid,
  renameUserLogin as renameUserLoginInSystemDb,
  seedUsersIfNeeded,
  updateUserPreferences as updateUserPreferencesInSystemDb,
  verifyLogin as verifyLoginInSystemDb,
} from "./users";
import type { LoginResult } from "./users";
import type { User, UserPreferences } from "./types";
import {
  MAX_PINS,
  isPinned as isPinnedInSystemDb,
  listPins as listPinsFromSystemDb,
  pinMaterial as pinMaterialInSystemDb,
  unpinMaterial as unpinMaterialInSystemDb,
} from "./pins";
import { triggerPinsChanged } from "./pinsBus";
import { buildPrintDocument, collectImageAttachmentKeys } from "./printHtml";
import { buildFileMaterialDraft } from "./fileMaterialDraft";
import type { PickedFile } from "./fileMaterialDraft";
import { checkReminder, loadBackupState, markBackupDone } from "./backupReminder";
import { runDatabaseUpkeep } from "./upkeep";
import type { UpkeepResult } from "./upkeep";
import type { BackupState, ReminderVerdict } from "./backupReminder";
import {
  activeServer,
  loadReplicationSettings,
  previewReplication,
  runReplication,
  saveReplicationSettings,
  toLastSyncRecords,
} from "./replication";
import type { ReplicationSettings, SyncOutcome, SyncPreview } from "./replication";
import { VIDEO_BINDINGS_ID, loadVideoBindings, videoForMaterial } from "./videoBindings";
import type { VideoBindingsMap } from "./videoBindings";
import { loadTrainingSettings, saveTrainingSettings } from "./training";
import type { TrainingProgress, TrainingSettings } from "./training";
import {
  assignTraining,
  listTrainingProgress,
  loadTrainingProgress,
  markModulePassed,
  recordMaterialView,
  unassignTraining,
} from "./trainingProgress";

export { MAX_PINS };

//
export const APP_VERSION: string = packageJson.version;

const MATERIAL_TYPES: MaterialType[] = ["article", "form", "presentation", "film"];

function isMaterialType(type: string): type is MaterialType {
  return (MATERIAL_TYPES as string[]).includes(type);
}

let contentDb: PouchDB.Database | null = null;
let systemDb: PouchDB.Database | null = null;
let filePort: FilePort | null = null;
let searchIndex: MaterialSearchIndex | null = null;
const changeBus = createChangeBus();
let changesFeed: PouchDB.Core.Changes<Record<string, unknown>> | null = null;

function requireContentDb(): PouchDB.Database {
  if (!contentDb) {
    throw new Error("Repository is not initialized: call initRepository() before use.");
  }
  return contentDb;
}

function requireSystemDb(): PouchDB.Database {
  if (!systemDb) {
    throw new Error("Repository is not initialized: call initRepository() before use.");
  }
  return systemDb;
}

function requireFilePort(): FilePort {
  if (!filePort) {
    throw new Error(
      "Repository was initialized without a file access port: pass filePort to initRepository().",
    );
  }
  return filePort;
}

async function logChange(
  op: Change["op"],
  materialId: string,
  materialType: MaterialType,
  materialTitle: string,
  userId: string,
): Promise<void> {
  const db = requireSystemDb();
  const change: Change = {
    _id: `change:${ulid()}`,
    type: "change",
    schemaVersion: SCHEMA_VERSION,
    targetId: materialId,
    targetType: materialType,
    targetTitle: materialTitle,
    op,
    userId,
    at: new Date().toISOString(),
  };
  await db.put(change);
}

function toSummary(doc: Material): MaterialSummary {
  return {
    _id: doc._id,
    type: doc.type,
    title: doc.title,
    sectionId: doc.sectionId,
    tags: doc.tags,
    card: doc.card,
    order: doc.order,
    excerpt: "excerpt" in doc ? doc.excerpt : null,
    updatedAt: doc.updatedAt,
    readingTime: "readingTime" in doc ? doc.readingTime : null,
    file: "file" in doc ? { ext: doc.file.original.ext, size: doc.file.original.size } : null,
    video: (() => {
      const video = videoForMaterial(doc, videoBindingsCache);
      return video ? { durationSec: video.durationSec } : null;
    })(),
  };
}

/**
 * The video bindings table, read once and kept in memory.
 *
 * It is needed for EVERY card in a list and every search hit, so fetching it
 * from the database per material would mean hundreds of extra reads for one
 * screen. It is re-read wherever the search index is rebuilt — on start, after
 * a file import and after a sync. Those are exactly the moments it can change.
 */
let videoBindingsCache: VideoBindingsMap = {};

async function rebuildSearchIndexFromScratch(): Promise<void> {
  const db = requireContentDb();
  const index = searchIndex!;
  index.clear();

  // BEFORE walking the documents: the summaries built below must already
  // know the bindings.
  videoBindingsCache = await loadVideoBindings(db);

  const result = await db.allDocs({ include_docs: true });
  for (const row of result.rows) {
    const doc = row.doc as unknown as Material | Section | undefined;
    if (!doc || !isMaterialType((doc as { type?: string }).type ?? "")) continue;
    const material = doc as Material;
    index.upsert(toSummary(material), material.plainText);
  }
}

function startChangesFeed(): void {
  const db = requireContentDb();
  changesFeed = db.changes({ live: true, since: "now", include_docs: true });

  changesFeed.on("change", (change) => {
    clearSyncError();
    pulseWriting();

    const doc = change.doc as unknown as Material | Section | undefined;

    if (change.deleted) {
      searchIndex?.remove(change.id);
      changeBus.emit({ op: "deleted", id: change.id });
      return;
    }

    /**
     * Found on 01.09.2026 while the owner was testing by hand: "I imported the
     * bindings and no videos appeared."
     *
     * The bindings table is neither a material nor a section, so the filter
     * below discarded it, and the cache was only re-read when the app started.
     * The table can arrive at any moment though — by file import or by a sync
     * with the server. It looked like "I imported it and nothing happened",
     * even though the data was already in the database and would have shown up
     * after a restart.
     *
     * Rebuilding the index also re-reads the cache (see its top) and refreshes
     * the summaries: it is the summaries that carry the "has video" mark.
     */
    if (change.id === VIDEO_BINDINGS_ID) {
      void rebuildSearchIndexFromScratch()
        .then(() => changeBus.emit({ op: "updated", id: change.id }))
        .catch(() => undefined);
      return;
    }

    if (doc && (doc as { type?: string }).type === "section") {
      changeBus.emit({ op: "updated", id: change.id, docType: "section" });
      return;
    }

    if (!doc || !isMaterialType((doc as { type?: string }).type ?? "")) return;

    const material = doc as Material;
    const summary = toSummary(material);
    searchIndex?.upsert(summary, material.plainText);

    const isCreate = change.changes.length === 1 && change.changes[0].rev.startsWith("1-");
    changeBus.emit({
      op: isCreate ? "created" : "updated",
      id: change.id,
      sectionId: material.sectionId,
      summary,
      docType: "material",
    });
  });

  changesFeed.on("error", (err) => {
    pulseError(err instanceof Error ? err.message : String(err));
  });
}

export interface RepositoryInitOptions {
  contentDb: PouchDB.Database;
  systemDb: PouchDB.Database;
  seed?: boolean;
  filePort?: FilePort;
}

export async function initRepository(options: RepositoryInitOptions): Promise<void> {
  await shutdownRepository();

  contentDb = options.contentDb;
  systemDb = options.systemDb;
  filePort = options.filePort ?? null;
  searchIndex = createMaterialSearchIndex();

  await ensureContentIndexes(contentDb);
  await ensureSystemIndexes(systemDb);

  if (options.seed !== false) {
    await seedContentIfNeeded(contentDb);
  }

  await migrateUserIdsToUlid(systemDb);

  await seedUsersIfNeeded(systemDb);

  await rebuildSearchIndexFromScratch();
  startChangesFeed();

  const activeIndex = searchIndex;
  loadSynonyms().then((groups) => activeIndex.setSynonyms(groups));
}

export async function shutdownRepository(): Promise<void> {
  if (changesFeed) {
    changesFeed.cancel();
    changesFeed = null;
  }
  changeBus.clear();
  searchIndex = null;
  contentDb = null;
  systemDb = null;
  filePort = null;
}

export function subscribe(listener: (event: RepoChangeEvent) => void): () => void {
  return changeBus.subscribe(listener);
}

function flattenSectionsHierarchically(sections: Section[]): Section[] {
  const byParent = new Map<string | null, Section[]>();
  for (const section of sections) {
    const siblings = byParent.get(section.parentId) ?? [];
    siblings.push(section);
    byParent.set(section.parentId, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.order - b.order);
  }

  const out: Section[] = [];
  function visit(parentId: string | null) {
    for (const section of byParent.get(parentId) ?? []) {
      out.push(section);
      visit(section._id);
    }
  }
  visit(null);
  return out;
}

export async function getSections(): Promise<Section[]> {
  const db = requireContentDb();
  const result = await db.allDocs({
    include_docs: true,
    startkey: "section:",
    endkey: "section:￿",
  });
  const sections = result.rows
    .map((row) => row.doc as unknown as Section)
    .filter((doc): doc is Section => Boolean(doc) && doc.type === "section");
  return flattenSectionsHierarchically(sections);
}

export async function getSectionById(id: string): Promise<Section | undefined> {
  const db = requireContentDb();
  try {
    const doc = await db.get(id);
    return doc as unknown as Section;
  } catch (err) {
    if ((err as PouchDB.Core.Error).status === 404) return undefined;
    throw err;
  }
}

export interface NewSectionInput {
  title: string;
  description: string;
  macroCategory: MacroCategory;
  order: number;
}

export async function createSection(input: NewSectionInput): Promise<Section> {
  const db = requireContentDb();
  const slug = slugify(input.title);
  const _id = buildSectionId(slug);

  const existing = await getSections();
  if (existing.some((s) => s.slug === slug)) {
    throw new Error(`A section with the address "${slug}" already exists — pick a different title.`);
  }

  const now = new Date().toISOString();
  const section: Omit<Section, "_rev"> = {
    _id,
    type: "section",
    schemaVersion: SCHEMA_VERSION,
    title: input.title,
    slug,
    description: input.description,
    macroCategory: input.macroCategory,
    parentId: null,
    layout: "list",
    order: input.order,
    cover: null,
    primaryTag: input.title.trim().toLowerCase(),
    legacy: { sourcePaths: [] },
    createdAt: now,
    updatedAt: now,
  };

  await db.put(section as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);
  const saved = await getSectionById(_id);
  if (!saved) throw new Error(`Section ${_id} not found right after creation`);
  return saved;
}

export async function setSectionHidden(sectionId: string, hidden: boolean): Promise<Section> {
  const db = requireContentDb();
  const existing = await db.get(sectionId);
  await db.put({ ...existing, hidden, updatedAt: new Date().toISOString() });
  const saved = await getSectionById(sectionId);
  if (!saved) throw new Error(`Section ${sectionId} not found right after the edit`);
  return saved;
}

const FIND_PAGE_SIZE = 1000;

export async function getMaterialsBySection(sectionId: string): Promise<MaterialSummary[]> {
  const db = requireContentDb();
  const docs: unknown[] = [];
  let skip = 0;
  for (;;) {
    const result = await db.find({
      selector: { sectionId, order: { $gte: null } },
      sort: [{ sectionId: "asc" }, { order: "asc" }] as unknown as string[],
      use_index: "idx_material_section_order",
      limit: FIND_PAGE_SIZE,
      skip,
    });
    docs.push(...result.docs);
    if (result.docs.length < FIND_PAGE_SIZE) break;
    skip += FIND_PAGE_SIZE;
  }
  return (docs as unknown as Material[]).map(toSummary).sort(compareMaterials);
}

export async function getMaterialById(id: string): Promise<Material | undefined> {
  const db = requireContentDb();
  try {
    const doc = (await db.get(id)) as unknown as Material;
    // The document may carry no `video` key at all — then the clip comes from
    // the bindings table. The field is filled in here so that the material
    // page and the player read it as usual and know nothing about bindings.
    if (!("video" in doc)) {
      const fromBindings = videoForMaterial(doc, videoBindingsCache);
      if (fromBindings) return { ...doc, video: fromBindings } as Material;
    }
    return doc;
  } catch (err) {
    if ((err as PouchDB.Core.Error).status === 404) return undefined;
    throw err;
  }
}

export async function getMaterialAttachmentUrl(materialId: string, attachmentKey: string): Promise<string> {
  const db = requireContentDb();
  const blob = await db.getAttachment(materialId, attachmentKey);
  return URL.createObjectURL(blob as Blob);
}

export async function getMaterialPdfUrl(materialId: string): Promise<string> {
  const material = await getMaterialById(materialId);
  if (!material || (material.type !== "form" && material.type !== "presentation")) {
    throw new Error(`getMaterialPdfUrl: material ${materialId} is not of a file type (form/presentation)`);
  }
  return getMaterialAttachmentUrl(materialId, material.file.pdf.attachment);
}

export async function buildMaterialPrintHtml(
  materialId: string,
): Promise<{ html: string; title: string; objectUrls: string[] } | null> {
  const material = await getMaterialById(materialId);
  if (!material) return null;
  if (material.type !== "article" && material.type !== "film") {
    throw new Error(`buildMaterialPrintHtml: material ${materialId} does not have a block body`);
  }

  const sections =
    material.type === "article"
      ? [{ heading: "", data: material.body }]
      : [
          { heading: "Introduction (before the screening)", data: material.intro },
          { heading: "Discussion questions (after the screening)", data: material.questions },
        ];

  const keys = [...new Set(sections.flatMap((s) => collectImageAttachmentKeys(s.data)))];
  const imageUrls: Record<string, string> = {};
  const objectUrls: string[] = [];
  for (const key of keys) {
    try {
      const url = await getMaterialAttachmentUrl(materialId, key);
      imageUrls[key] = url;
      objectUrls.push(url);
    } catch {
    }
  }

  const section = await getSectionById(material.sectionId);
  const meta = [section?.title, `updated ${new Date(material.updatedAt).toLocaleDateString("en-US")}`]
    .filter(Boolean)
    .join(" · ");

  return {
    html: buildPrintDocument({ title: material.title, meta, imageUrls, sections }),
    title: material.title,
    objectUrls,
  };
}

const EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

function saveFilterForFileName(fileName: string): { mimeType: string; filter: SaveFilter | undefined } {
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  if (!ext) return { mimeType: "application/octet-stream", filter: undefined };
  const mimeType = EXTENSION_MIME_TYPES[ext] ?? "application/octet-stream";
  return { mimeType, filter: { label: ext.toUpperCase(), extensions: [ext] } };
}

function extensionForMimeType(mimeType: string): string | null {
  for (const [ext, mime] of Object.entries(EXTENSION_MIME_TYPES)) {
    if (mime === mimeType) return ext;
  }
  return null;
}

export async function pickLocalFile(
  filter: SaveFilter,
  fallbackName: string,
): Promise<{ name: string; bytes: Uint8Array } | null> {
  const port = requireFilePort();
  const handle = await port.pickFile(filter);
  if (handle === null || handle === undefined) return null;
  const bytes = await port.readDump(handle);
  return { name: port.fileName?.(handle) ?? fallbackName, bytes };
}

export async function getMaterialAttachmentKeys(materialId: string): Promise<Set<string>> {
  const material = await getMaterialById(materialId);
  return new Set(Object.keys(material?._attachments ?? {}));
}

export async function downloadMaterialAttachment(
  materialId: string,
  attachmentKey: string,
  fileName: string,
): Promise<boolean> {
  const db = requireContentDb();
  const blob = await db.getAttachment(materialId, attachmentKey);
  const bytes =
    blob instanceof Blob ? new Uint8Array(await blob.arrayBuffer()) : new Uint8Array(blob as unknown as ArrayBufferLike);
  const actualMimeType = blob instanceof Blob ? blob.type : "";

  const hasExtension = fileName.lastIndexOf(".") > 0;
  const resolvedFileName = hasExtension
    ? fileName
    : (() => {
        const ext = actualMimeType ? extensionForMimeType(actualMimeType) : null;
        return ext ? `${fileName}.${ext}` : fileName;
      })();

  const port = requireFilePort();
  const { mimeType: mimeFromExt, filter } = saveFilterForFileName(resolvedFileName);
  const mimeType = actualMimeType || mimeFromExt;
  const location = await port.pickSaveLocation(resolvedFileName, "Where to save the file", filter);
  if (!location) return false;
  await port.writeDump(location, bytes, mimeType);
  return true;
}

export async function downloadMaterialOriginal(materialId: string): Promise<boolean> {
  const material = await getMaterialById(materialId);
  if (!material || (material.type !== "form" && material.type !== "presentation")) {
    throw new Error(`downloadMaterialOriginal: material ${materialId} is not of a file type (form/presentation)`);
  }
  return downloadMaterialAttachment(materialId, material.file.original.attachment, material.file.original.name);
}

export async function addMaterialAttachment(
  materialId: string,
  key: string,
  contentType: string,
  data: PouchDB.Core.AttachmentData,
): Promise<void> {
  const db = requireContentDb();
  const current = await db.get(materialId);
  await db.putAttachment(materialId, key, current._rev, data, contentType);
}

interface NewArticleInput {
  type: "article";
  sectionId: string;
  title: string;
  body: EditorJsOutputData;
  cardColor?: Card["color"];
  tags?: string[];
  createdBy: string;
  authorId?: string;
}

interface NewFilmInput {
  type: "film";
  sectionId: string;
  title: string;
  intro: EditorJsOutputData;
  questions: EditorJsOutputData;
  cardColor?: Card["color"];
  createdBy: string;
  authorId?: string;
}

interface NewFileInput {
  type: "form" | "presentation";
  sectionId: string;
  title: string;
  file: MaterialFile;
  attachments: PouchDB.Core.Attachments;
  cardColor?: Card["color"];
  tags?: string[];
  cover?: Card["cover"];
  plainText?: string;
  createdBy: string;
  authorId?: string;
}

export type NewMaterialInput = NewArticleInput | NewFilmInput | NewFileInput;

async function nextOrderInSection(sectionId: string): Promise<number> {
  const existing = await getMaterialsBySection(sectionId);
  return existing.reduce((max, m) => Math.max(max, m.order), 0) + 1;
}

export async function createMaterial(input: NewMaterialInput): Promise<Material> {
  const db = requireContentDb();
  const now = new Date().toISOString();
  const sectionSlug = sectionSlugFromId(input.sectionId);
  const _id = buildAppMaterialId(input.type, sectionSlug, input.title);
  const order = await nextOrderInSection(input.sectionId);
  const card: Card = {
    color: input.cardColor ?? "neutral",
    cover: input.type === "form" || input.type === "presentation" ? (input.cover ?? null) : null,
  };

  const envelope = {
    _id,
    schemaVersion: SCHEMA_VERSION,
    title: input.title,
    sectionId: input.sectionId,
    tags: input.type === "film" ? ([] as string[]) : (input.tags ?? []),
    card,
    order,
    createdBy: input.createdBy,
    createdAt: now,
    updatedBy: input.createdBy,
    updatedAt: now,
    legacy: null,
  };

  let doc: Material;

  if (input.type === "article") {
    const derivedFields = computeArticleDerivedFields(input.body);
    doc = { ...envelope, type: "article", body: input.body, ...derivedFields } as Material;
  } else if (input.type === "film") {
    const derivedFields = computeFilmDerivedFields(input.intro, input.questions);
    doc = {
      ...envelope,
      type: "film",
      intro: input.intro,
      questions: input.questions,
      video: null,
      ...derivedFields,
    } as Material;
  } else {
    const derivedFields = computeFileDerivedFields(input.title, input.plainText);
    doc = {
      ...envelope,
      type: input.type,
      file: input.file,
      ...derivedFields,
      _attachments: input.attachments,
    } as unknown as Material;
  }

  await db.put(doc as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);
  await logChange("create", _id, input.type, input.title, input.authorId ?? input.createdBy);
  const saved = await getMaterialById(_id);
  if (!saved) throw new Error(`Material ${_id} not found right after creation`);
  return saved;
}

export interface CreateFileMaterialInput {
  type: "form" | "presentation";
  sectionId: string;
  title: string;
  tags?: string[];
  pdf: PickedFile;
  original?: PickedFile | null;
  coverPng?: Uint8Array | null;
  plainText?: string;
  createdBy: string;
  authorId?: string;
}

export async function createFileMaterial(input: CreateFileMaterialInput): Promise<Material> {
  const draft = buildFileMaterialDraft({
    pdf: input.pdf,
    original: input.original ?? null,
    coverPng: input.coverPng ?? null,
  });
  return createMaterial({
    type: input.type,
    sectionId: input.sectionId,
    title: input.title,
    tags: input.tags ?? [],
    file: draft.file,
    attachments: draft.attachments,
    cover: draft.cover,
    plainText: input.plainText,
    createdBy: input.createdBy,
    authorId: input.authorId,
  });
}

export interface UpdateMaterialPatch {
  title?: string;
  sectionId?: string;
  tags?: string[];
  card?: Card;
  order?: number;
  body?: EditorJsOutputData;
  intro?: EditorJsOutputData;
  questions?: EditorJsOutputData;
  video?: MaterialVideo | string | null;
  updatedBy: string;
  authorId?: string;
}

function videoForWrite(value: MaterialVideo | string | null): MaterialVideo | null {
  if (value === null) return null;
  if (typeof value === "string") {
    throw new Error("A video is bound by a file path inside the videos folder, not by a link.");
  }
  const normalized = normalizeVideo(value);
  if (!normalized) {
    throw new Error("The video has no file set: a file name inside the videos folder is expected.");
  }
  if (!isSafeVideoPath(normalized.path)) {
    throw new Error(
      `The video path "${normalized.path}" escapes the videos folder. ` +
        'A file name or a name in a nested folder is expected — no "..", no drive letter, no root.',
    );
  }
  return normalized;
}

function recomputeTagsForSectionChange(
  tags: string[],
  oldPrimaryTag: string | undefined,
  newPrimaryTag: string | undefined,
): string[] {
  const withoutOldPrimary = oldPrimaryTag ? tags.filter((t) => t !== oldPrimaryTag) : tags;
  if (newPrimaryTag && !withoutOldPrimary.includes(newPrimaryTag)) {
    return [...withoutOldPrimary, newPrimaryTag];
  }
  return withoutOldPrimary;
}

export async function updateMaterial(id: string, patch: UpdateMaterialPatch): Promise<Material> {
  const db = requireContentDb();
  const existing = await db.get(id);
  const current = existing as unknown as Material;
  const now = new Date().toISOString();

  const sectionChanged = patch.sectionId !== undefined && patch.sectionId !== current.sectionId;
  let tags = patch.tags ?? current.tags;
  if (sectionChanged && patch.tags === undefined) {
    const [oldSection, newSection] = await Promise.all([
      getSectionById(current.sectionId),
      getSectionById(patch.sectionId as string),
    ]);
    tags = recomputeTagsForSectionChange(current.tags, oldSection?.primaryTag, newSection?.primaryTag);
  }

  const merged: Material = {
    ...current,
    title: patch.title ?? current.title,
    sectionId: patch.sectionId ?? current.sectionId,
    tags,
    card: patch.card ?? current.card,
    order: patch.order ?? current.order,
    updatedBy: patch.updatedBy,
    updatedAt: now,
  };

  let referencedAttachmentKeys: Set<string> | null = null;

  if (merged.type === "article") {
    merged.body = patch.body ?? merged.body;
    Object.assign(merged, computeArticleDerivedFields(merged.body));
    referencedAttachmentKeys = collectReferencedAttachmentKeys(merged.body);
    if (patch.video !== undefined) merged.video = videoForWrite(patch.video);
  } else if (merged.type === "film") {
    merged.intro = patch.intro ?? merged.intro;
    merged.questions = patch.questions ?? merged.questions;
    Object.assign(merged, computeFilmDerivedFields(merged.intro, merged.questions));
    referencedAttachmentKeys = collectReferencedAttachmentKeys(merged.intro, merged.questions);
    if (patch.video !== undefined) merged.video = videoForWrite(patch.video);
  } else if (patch.video !== undefined) {
    throw new Error(`Material ${id} of type ${merged.type} has no video: it has a file, not a body.`);
  } else {
    Object.assign(
      merged,
      computeFileDerivedFields(merged.title, (current as { plainText?: string }).plainText, current.title),
    );
  }

  if (referencedAttachmentKeys && merged._attachments) {
    const orphaned = computeOrphanedAttachmentKeys(Object.keys(merged._attachments), referencedAttachmentKeys);
    if (orphaned.length > 0) {
      const attachments = { ...merged._attachments };
      for (const key of orphaned) delete attachments[key];
      merged._attachments = attachments;
    }
  }

  await db.put(merged as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);
  await logChange("update", id, merged.type, merged.title, patch.authorId ?? patch.updatedBy);

  if (sectionChanged) {
    await logAppEvent("info", "material.section_moved", {
      materialId: id,
      title: merged.title,
      from: current.sectionId,
      to: merged.sectionId,
      by: patch.updatedBy,
    });
  }

  const saved = await getMaterialById(id);
  if (!saved) throw new Error(`Material ${id} not found right after the update`);
  return saved;
}

export interface DeletedMaterialSnapshot {
  material: Material;
  tombstoneRev: string;
}

export async function deleteMaterial(
  id: string,
  deletedBy: string,
  authorId?: string,
): Promise<DeletedMaterialSnapshot> {
  const db = requireContentDb();
  const full = await db.get(id, { attachments: true });
  const material = full as unknown as Material;
  const result = await db.remove(full);
  await logChange("delete", id, material.type, material.title, authorId ?? deletedBy);
  await logAppEvent("info", "material.deleted", {
    materialId: id,
    title: material.title,
    sectionId: material.sectionId,
    attachmentKeys: Object.keys(material._attachments ?? {}),
    by: deletedBy,
  });
  return { material, tombstoneRev: result.rev };
}

export async function restoreMaterial(
  snapshot: DeletedMaterialSnapshot,
  restoredBy: string,
  authorId?: string,
): Promise<Material> {
  const db = requireContentDb();
  const { material, tombstoneRev } = snapshot;
  const restored = { ...material, _rev: tombstoneRev };
  await db.put(restored as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);
  await logChange("update", material._id, material.type, material.title, authorId ?? restoredBy);
  await logAppEvent("info", "material.restored", {
    materialId: material._id,
    title: material.title,
    by: restoredBy,
  });
  const saved = await getMaterialById(material._id);
  if (!saved) throw new Error(`Material ${material._id} not found right after the restore`);
  return saved;
}

export async function searchMaterials(query: string): Promise<SearchHit[]> {
  if (!searchIndex) return [];
  return searchIndex.search(query);
}

export async function getMaterialsByTag(tag: string): Promise<MaterialSummary[]> {
  if (!searchIndex) return [];
  return searchIndex.searchByTag(tag);
}

export async function getSearchSuggestions(query: string): Promise<string[]> {
  if (!searchIndex) return [];
  return searchIndex.suggest(query);
}

export async function getAllTags(): Promise<string[]> {
  if (!searchIndex) return [];
  return searchIndex.allTags();
}

export async function getRelatedMaterials(
  materialId: string,
  tags: readonly string[],
  limit = 5,
): Promise<MaterialSummary[]> {
  if (!searchIndex) return [];
  const scored = new Map<string, { summary: MaterialSummary; score: number }>();
  for (const tag of tags) {
    for (const summary of searchIndex.searchByTag(tag)) {
      if (summary._id === materialId) continue;
      const entry = scored.get(summary._id);
      if (entry) entry.score += 1;
      else scored.set(summary._id, { summary, score: 1 });
    }
  }
  return [...scored.values()]
    .sort((a, b) => b.score - a.score || b.summary.updatedAt.localeCompare(a.summary.updatedAt))
    .slice(0, limit)
    .map((entry) => entry.summary);
}

export async function exportDatabase(): Promise<ExportFilesResult | null> {
  const result = await exportDatabaseToFiles(requireFilePort(), requireContentDb(), requireSystemDb());
  if (result) await markBackupDone(requireSystemDb(), "content");
  return result;
}

export async function getBackupState(): Promise<BackupState> {
  return loadBackupState(requireSystemDb());
}

export async function getBackupReminder(): Promise<ReminderVerdict> {
  return checkReminder(await loadBackupState(requireSystemDb()));
}

export async function importDatabase(onProgress?: (progress: ImportProgress) => void): Promise<ImportReport | null> {
  return importDatabaseFromFiles(requireFilePort(), requireContentDb(), requireSystemDb(), onProgress);
}

export async function exportSeedForInstaller(): Promise<SeedExportResult> {
  return exportSeedBundle(requireFilePort(), requireContentDb(), requireSystemDb());
}

export async function backupSystemDb(): Promise<WrittenDump> {
  const written = await backupSystemDatabase(requireFilePort(), requireSystemDb());
  await markBackupDone(requireSystemDb(), "system");
  return written;
}

export async function restoreSystemDb(): Promise<SystemRestoreReport | null> {
  return restoreSystemDatabaseFromFiles(requireFilePort(), requireSystemDb());
}

export async function listUsers(): Promise<User[]> {
  return listUsersFromSystemDb(requireSystemDb());
}

export async function login(loginName: string, password: string): Promise<LoginResult | null> {
  return verifyLoginInSystemDb(requireSystemDb(), loginName, password);
}

export async function changePassword(userId: string, newPassword: string): Promise<void> {
  await changeUserPassword(requireSystemDb(), userId, newPassword);
}

export async function createUser(loginName: string, displayName: string, password: string): Promise<User> {
  return createUserInSystemDb(requireSystemDb(), loginName, displayName, password);
}

export async function renameLogin(userId: string, newLogin: string): Promise<User> {
  return renameUserLoginInSystemDb(requireSystemDb(), userId, newLogin);
}

export async function updateUserPreferences(userId: string, patch: UserPreferences): Promise<User> {
  return updateUserPreferencesInSystemDb(requireSystemDb(), userId, patch);
}

export async function getUserDisplayNames(): Promise<Record<string, string>> {
  return buildUserDisplayNames(await listUsersFromSystemDb(requireSystemDb()));
}

// --- Induction course for a new consultant ------------------------------------

export async function getTrainingSettings(): Promise<TrainingSettings> {
  return loadTrainingSettings(requireSystemDb());
}

export async function setTrainingSettings(
  patch: Partial<Pick<TrainingSettings, "enabled">>,
): Promise<TrainingSettings> {
  return saveTrainingSettings(requireSystemDb(), patch);
}

export async function getTrainingProgress(userId: string): Promise<TrainingProgress> {
  return loadTrainingProgress(requireSystemDb(), userId);
}

/** Everyone's progress — the log the programme lead reads. */
export async function getAllTrainingProgress(): Promise<TrainingProgress[]> {
  return listTrainingProgress(requireSystemDb());
}

/**
 * Record that a member of staff opened a material.
 *
 * The error is swallowed on purpose: this is a background mark made while an
 * article opens, and breaking the reading of a material over it would be a bad
 * trade.
 */
export async function recordTrainingView(userId: string, materialId: string): Promise<void> {
  try {
    await recordMaterialView(requireSystemDb(), userId, materialId);
  } catch {
    // Progress is not the centre's data; one lost mark is not worth a broken screen.
  }
}

export async function markTrainingModulePassed(
  userId: string,
  moduleId: string,
  pass: { correct: number; total: number },
): Promise<TrainingProgress> {
  const saved = await markModulePassed(requireSystemDb(), userId, moduleId, pass);
  await logAppEvent("info", "training.module.passed", { userId, moduleId, ...pass });
  return saved;
}

export async function assignTrainingTo(userId: string, assignedBy: string): Promise<TrainingProgress> {
  const saved = await assignTraining(requireSystemDb(), userId, assignedBy);
  await logAppEvent("info", "training.assigned", { userId, assignedBy });
  return saved;
}

export async function unassignTrainingFrom(userId: string): Promise<TrainingProgress> {
  const saved = await unassignTraining(requireSystemDb(), userId);
  await logAppEvent("info", "training.unassigned", { userId });
  return saved;
}

// --- Replication with the server ----------------------------------------------

export async function getReplicationSettings(): Promise<ReplicationSettings> {
  return loadReplicationSettings(requireSystemDb());
}

/**
 * What a sync would change, before the sync itself. Reads only lists of ids
 * and revisions, writes nothing and moves nothing, so it is safe to call
 * before every press.
 */
export async function previewServerSync(): Promise<SyncPreview> {
  const systemDb = requireSystemDb();
  const contentDb = requireContentDb();
  const settings = await loadReplicationSettings(systemDb);
  const PouchCtor = (contentDb as unknown as { constructor: unknown })
    .constructor as new (name: string, options?: PouchDB.Configuration.DatabaseConfiguration) => PouchDB.Database;
  return previewReplication(PouchCtor, systemDb, contentDb, settings);
}

export async function setReplicationSettings(
  patch: Partial<Omit<ReplicationSettings, "_id" | "_rev" | "type" | "schemaVersion">>,
): Promise<ReplicationSettings> {
  return saveReplicationSettings(requireSystemDb(), patch);
}

export async function replicateWithServer(): Promise<SyncOutcome[]> {
  const systemDb = requireSystemDb();
  const contentDb = requireContentDb();
  const settings = await loadReplicationSettings(systemDb);
  const PouchCtor = (contentDb as unknown as { constructor: unknown })
    .constructor as new (name: string, options?: PouchDB.Configuration.DatabaseConfiguration) => PouchDB.Database;

  const outcomes = await runReplication(PouchCtor, systemDb, contentDb, settings);
  await saveReplicationSettings(systemDb, { lastSync: toLastSyncRecords(outcomes) });
  await logAppEvent("info", "replication.run", {
    server: activeServer(settings)?.url ?? null,
    outcomes: outcomes.map((o) => ({ database: o.database, ok: o.ok, read: o.docsRead, written: o.docsWritten })),
  });

  await rebuildSearchIndexFromScratch();
  return outcomes;
}

export async function isMaterialPinned(userId: string, materialId: string): Promise<boolean> {
  return isPinnedInSystemDb(requireSystemDb(), userId, materialId);
}

export async function pinMaterial(userId: string, materialId: string): Promise<void> {
  await pinMaterialInSystemDb(requireSystemDb(), userId, materialId);
  triggerPinsChanged();
}

export async function unpinMaterial(userId: string, materialId: string): Promise<void> {
  await unpinMaterialInSystemDb(requireSystemDb(), userId, materialId);
  triggerPinsChanged();
}

export async function getPinnedMaterials(userId: string): Promise<MaterialSummary[]> {
  const pins = await listPinsFromSystemDb(requireSystemDb(), userId);
  const materials = await Promise.all(pins.map((pin) => getMaterialById(pin.materialId)));
  return materials.filter((m): m is Material => Boolean(m)).map(toSummary);
}

export async function getPinnedCount(userId: string): Promise<number> {
  return (await listPinsFromSystemDb(requireSystemDb(), userId)).length;
}

export const CHANGE_LOG_PAGE_SIZE = 500;

export const MATERIAL_HISTORY_LIMIT = 50;

export async function getChangeLog(limit = CHANGE_LOG_PAGE_SIZE): Promise<Change[]> {
  const db = requireSystemDb();
  const result = await db.allDocs({
    include_docs: true,
    startkey: "change:￿",
    endkey: "change:",
    descending: true,
    ...(limit > 0 ? { limit } : {}),
  });
  return result.rows
    .map((row) => row.doc as unknown as Change)
    .filter((doc): doc is Change => Boolean(doc && (doc as unknown as { type?: string }).type === "change"));
}

export async function getChangeLogForMaterial(
  materialId: string,
  limit = MATERIAL_HISTORY_LIMIT,
): Promise<Change[]> {
  const db = requireSystemDb();
  const result = await db.find({
    selector: { targetId: materialId, at: { $gt: null } },
    sort: [
      { targetId: "desc" },
      { at: "desc" },
    ],
    limit,
  });
  return (result.docs as unknown as Change[]).filter(
    (doc) => (doc as unknown as { type?: string }).type === "change",
  );
}

export async function exportChangeLogToFile(entries: Change[]): Promise<boolean> {
  const port = requireFilePort();
  const generatedAt = new Date().toISOString();
  const bytes = new TextEncoder().encode(JSON.stringify({ generatedAt, entries }, null, 2));
  const suggestedName = `aurora-journal-${generatedAt.replace(/[:.]/g, "-")}.json`;
  const location = await port.pickSaveLocation(suggestedName, "Where to save the change log", {
    label: "JSON",
    extensions: ["json"],
  });
  if (!location) return false;
  await port.writeDump(location, bytes, "application/json");
  return true;
}

const DIAGNOSTICS_APPLOG_LIMIT = 500;
const DIAGNOSTICS_MAX_BYTES = 5 * 1024 * 1024;

export async function logAppEvent(
  level: AppLog["level"],
  event: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  try {
    const db = requireSystemDb();
    await db.put<Omit<AppLog, "_id">>({
      _id: `applog:${ulid()}`,
      type: "applog",
      schemaVersion: SCHEMA_VERSION,
      level,
      event,
      context,
      at: new Date().toISOString(),
    } as AppLog);
  } catch {
  }
}

export const APPLOG_KEEP_ENTRIES = 2000;

export async function pruneAppLog(keep = APPLOG_KEEP_ENTRIES): Promise<number> {
  const db = requireSystemDb();
  const result = await db.allDocs({
    startkey: "applog:￿",
    endkey: "applog:",
    descending: true,
  });
  const stale = result.rows.slice(keep);
  if (stale.length === 0) return 0;
  await db.bulkDocs(
    stale.map((row) => ({ _id: row.id, _rev: row.value.rev, _deleted: true })) as unknown as PouchDB.Core.PutDocument<
      Record<string, unknown>
    >[],
  );
  return stale.length;
}

export async function getAppLog(limit = DIAGNOSTICS_APPLOG_LIMIT): Promise<AppLog[]> {
  const db = requireSystemDb();
  const result = await db.allDocs({
    include_docs: true,
    startkey: "applog:￿",
    endkey: "applog:",
    descending: true,
    limit,
  });
  return result.rows
    .map((row) => row.doc as unknown as AppLog)
    .filter((doc): doc is AppLog => Boolean(doc && (doc as unknown as { type?: string }).type === "applog"));
}

export interface DiagnosticsEnvironment {
  userAgent: string;
  platform: string;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  liteMode: boolean;
}

interface DiagnosticsReport {
  generatedAt: string;
  appVersion: string;
  schemaVersion: number;
  documents: { content: number; system: number };
  environment: DiagnosticsEnvironment;
  perf: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | null;
  appLog: Array<Pick<AppLog, "level" | "event" | "context" | "at"> & { id: string }>;
}

function serializeDiagnosticsWithinLimit(report: DiagnosticsReport, maxBytes: number): Uint8Array {
  let log = report.appLog;
  for (;;) {
    const bytes = new TextEncoder().encode(JSON.stringify({ ...report, appLog: log }, null, 2));
    if (bytes.length <= maxBytes || log.length === 0) return bytes;
    log = log.slice(0, Math.floor(log.length / 2));
  }
}

export async function exportDiagnosticsLog(environment: DiagnosticsEnvironment): Promise<boolean> {
  const [contentInfo, systemInfo, appLog] = await Promise.all([
    requireContentDb().info(),
    requireSystemDb().info(),
    getAppLog(),
  ]);

  const memory = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  const perf = memory
    ? { usedJSHeapSize: memory.usedJSHeapSize, totalJSHeapSize: memory.totalJSHeapSize, jsHeapSizeLimit: memory.jsHeapSizeLimit }
    : null;

  const report: DiagnosticsReport = {
    generatedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    documents: { content: contentInfo.doc_count, system: systemInfo.doc_count },
    environment,
    perf,
    appLog: appLog.map((entry) => ({ id: entry._id, level: entry.level, event: entry.event, context: entry.context, at: entry.at })),
  };

  const bytes = serializeDiagnosticsWithinLimit(report, DIAGNOSTICS_MAX_BYTES);
  const port = requireFilePort();
  const suggestedName = `aurora-diagnostics-${report.generatedAt.replace(/[:.]/g, "-")}.json`;
  const location = await port.pickSaveLocation(suggestedName, "Where to save the diagnostics log", {
    label: "JSON",
    extensions: ["json"],
  });
  if (!location) return false;
  await port.writeDump(location, bytes, "application/json");
  return true;
}

export async function runUpkeep(force = false): Promise<UpkeepResult> {
  return runDatabaseUpkeep({
    contentDb: requireContentDb(),
    systemDb: requireSystemDb(),
    pruneAppLog: () => pruneAppLog(),
    force,
  });
}
