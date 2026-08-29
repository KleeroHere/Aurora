
export const SCHEMA_VERSION = 1;

export type MaterialType = "article" | "form" | "presentation" | "film";

export type CardColor = "green" | "blue" | "red" | "purple" | "pink" | "neutral";

export interface Card {
  color: CardColor;
  cover: {
    attachment: string;
    attachmentWarm?: string;
  } | null;
}

export interface MaterialVideo {
  path: string;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  posterFrameSec: number | null;
}

export interface MaterialLegacy {
  sourcePath: string;
  sourceName: string;
  sourceRef?: string;
  migratedAt: string;
}

export interface MaterialEnvelope {
  _id: string;
  _rev?: string;
  schemaVersion: number;
  title: string;
  sectionId: string;
  tags: string[];
  card: Card;
  order: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  legacy: MaterialLegacy | null;
  _attachments?: PouchDB.Core.Attachments;
}

export interface EditorJsListItem {
  content: string;
  meta: Record<string, unknown>;
  items: EditorJsListItem[];
}

export type EditorJsBlock =
  | { id?: string; type: "header"; data: { text: string; level: number } }
  | { id?: string; type: "paragraph"; data: { text: string } }
  | {
      id?: string;
      type: "list";
      data: {
        style: "ordered" | "unordered" | "checklist";
        meta: Record<string, unknown>;
        items: EditorJsListItem[];
      };
    }
  | { id?: string; type: "quote"; data: { text: string; caption: string } }
  | {
      id?: string;
      type: "alert";
      data: { type: "warning" | "danger"; align: string; text: string };
    }
  | {
      id?: string;
      type: "image";
      data: { file: { key: string }; caption: string };
    }
  | {
      id?: string;
      type: "attaches";
      data: { file: { key: string; name: string; ext: string; size: number }; title: string };
    }
  | {
      id?: string;
      type: "table";
      data: { withHeadings: boolean; content: string[][] };
    };

export interface EditorJsOutputData {
  time: number;
  blocks: EditorJsBlock[];
  version: string;
}

// --- article -------------------------------------------------------------

export interface Article extends MaterialEnvelope {
  type: "article";
  body: EditorJsOutputData;
  plainText: string;
  excerpt: string;
  readingTime: number;
  video?: MaterialVideo | string | null;
}

// --- form / presentation --------------------------------------------------

export type FileExt = "docx" | "xlsx" | "doc" | "ppt" | "pptx" | "pdf";

export interface MaterialFile {
  original: { attachment: string; name: string; ext: FileExt; size: number };
  pdf: { attachment: string; size: number };
}

export interface FormDoc extends MaterialEnvelope {
  type: "form";
  file: MaterialFile;
  plainText: string;
  excerpt: string | null;
}

export interface Presentation extends MaterialEnvelope {
  type: "presentation";
  file: MaterialFile;
  plainText: string;
  excerpt: string | null;
}

// --- film ------------------------------------------------------------------

export interface Film extends MaterialEnvelope {
  type: "film";
  intro: EditorJsOutputData;
  questions: EditorJsOutputData;
  video: MaterialVideo | string | null;
  plainText: string;
  readingTime: number | null;
}

export type Material = Article | FormDoc | Presentation | Film;

export interface MaterialSummary {
  _id: string;
  type: MaterialType;
  title: string;
  sectionId: string;
  tags: string[];
  card: Card;
  order: number;
  excerpt: string | null;
  updatedAt: string;
  readingTime: number | null;
  file: { ext: FileExt; size: number } | null;
  video: { durationSec: number | null } | null;
}

export type MacroCategory = "formal" | "methods" | "instructions" | "other";
export type SectionLayout = "list" | "grid" | "carousel";

export interface SectionLegacy {
  sourcePaths: string[];
}

export interface Section {
  _id: string;
  _rev?: string;
  type: "section";
  schemaVersion: number;
  title: string;
  slug: string;
  description: string;
  macroCategory: MacroCategory;
  parentId: string | null;
  layout: SectionLayout;
  order: number;
  cover: { attachment: string } | null;
  primaryTag: string;
  legacy: SectionLegacy;
  createdAt: string;
  updatedAt: string;
  hidden?: boolean;
}

export const MACRO_CATEGORIES: Record<MacroCategory, string> = {
  formal: "Formal documents",
  methods: "Programme and practice",
  instructions: "Instructions and protocols",
  other: "After the programme",
};

export type Palette = "aurora" | "clinic" | "nightshift";

/** Every palette value, in the order the appearance settings offer them. */
export const PALETTES: readonly Palette[] = ["aurora", "clinic", "nightshift"];

export type Scheme = "light" | "dark";

export interface UserPreferences {
  palette?: Palette;
  scheme?: Scheme;
  tourSeenAt?: string;
}

export interface User {
  _id: string;
  _rev?: string;
  type: "user";
  schemaVersion: number;
  login: string;
  displayName: string;
  passwordHash: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  preferences?: UserPreferences;
}

export interface Change {
  _id: string;
  _rev?: string;
  type: "change";
  schemaVersion: number;
  targetId: string;
  targetType: MaterialType;
  targetTitle: string;
  op: "create" | "update" | "delete";
  userId: string;
  at: string;
}

export interface AppLog {
  _id: string;
  _rev?: string;
  type: "applog";
  schemaVersion: number;
  level: "debug" | "info" | "warn" | "error";
  event: string;
  context: Record<string, unknown>;
  at: string;
}

export interface Pin {
  _id: string;
  _rev?: string;
  type: "pin";
  schemaVersion: number;
  userId: string;
  materialId: string;
  order: number;
  createdAt: string;
}

export interface SeedState {
  _id: string;
  _rev?: string;
  type: "seedstate";
  schemaVersion: number;
  status: "in-progress" | "seeded" | "skipped-not-empty" | "failed";
  bundleCreatedAt: string | null;
  bundleDocCount: number | null;
  seededAt: string;
  error: string | null;
}

export type ContentDoc = Material | Section;
export type SystemDoc = User | Change | AppLog | Pin | SeedState;
