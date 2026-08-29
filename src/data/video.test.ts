import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDuration, isSafeVideoPath, normalizeVideo, videoOfMaterial } from "./videoPort";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import { createContentDb, createSystemDb } from "./db";
import { buildOutputData, eBlockParagraph } from "./seedData";
import {
  buildMaterialPrintHtml,
  createMaterial,
  getMaterialById,
  initRepository,
  shutdownRepository,
  updateMaterial,
} from "./repository";
import type { Article, Material, Section } from "./types";
import {
  clearVideoPosition,
  isEffectivelyFinished,
  readVideoPosition,
  shouldRemember,
  writeVideoPosition,
} from "./videoPosition";

describe("the shape of the video field in a document", () => {
  it("a normal object passes and fills in the missing fields", () => {
    expect(normalizeVideo({ path: "intro.mp4" } as never)).toEqual({
      path: "intro.mp4",
      durationSec: null,
      width: null,
      height: null,
      posterFrameSec: null,
    });
  });

  it("empty and null just mean \"no video\", not an error", () => {
    expect(normalizeVideo(null)).toBeNull();
    expect(normalizeVideo(undefined)).toBeNull();
    expect(normalizeVideo({ path: "  " } as never)).toBeNull();
  });

  it("a historical string (a link) reads as \"no video\" instead of crashing the page", () => {
    expect(normalizeVideo("https://youtube.com/watch?v=x")).toBeNull();
  });
});

describe("the video path", () => {
  it("a simple name and a nested folder are allowed", () => {
    expect(isSafeVideoPath("intro.mp4")).toBe(true);
    expect(isSafeVideoPath("series/intro.mp4")).toBe(true);
  });

  it("escaping the videos folder is rejected", () => {
    for (const bad of [
      "",
      "..",
      "../secret.mp4",
      "series/../../secret.mp4",
      "/etc/passwd",
      "\\\\server\\share\\x.mp4",
      "C:/Windows/System32/x.mp4",
      " intro.mp4",
      "./x.mp4",
    ]) {
      expect(isSafeVideoPath(bad), `"${bad}" must be rejected`).toBe(false);
    }
  });
});

describe("human-friendly duration", () => {
  it("minutes and seconds; hours only when present", () => {
    expect(formatDuration(95)).toBe("1:35");
    expect(formatDuration(6)).toBe("0:06");
    expect(formatDuration(3725)).toBe("1:02:05");
  });

  it("an unknown duration does not turn into \"0:00\"", () => {
    expect(formatDuration(null)).toBe("");
    expect(formatDuration(undefined)).toBe("");
    expect(formatDuration(Number.NaN)).toBe("");
  });
});

describe("remembered position", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("the middle of a video is remembered and read back", () => {
    writeVideoPosition("film:intro", 62.7, 180);
    expect(readVideoPosition("film:intro")).toBe(62);
  });

  it("the first seconds are not remembered — \"resume from 0:03\" is no help", () => {
    writeVideoPosition("film:intro", 3, 180);
    expect(readVideoPosition("film:intro")).toBeNull();
  });

  it("a video watched to the end does not offer to resume from the credits", () => {
    expect(isEffectivelyFinished(175, 180)).toBe(true);
    expect(isEffectivelyFinished(1795, 1800)).toBe(true);
    expect(isEffectivelyFinished(90, 180)).toBe(false);

    writeVideoPosition("film:intro", 178, 180);
    expect(readVideoPosition("film:intro")).toBeNull();
  });

  it("a new position overwrites the old one, and finishing erases it", () => {
    writeVideoPosition("film:intro", 30, 180);
    writeVideoPosition("film:intro", 90, 180);
    expect(readVideoPosition("film:intro")).toBe(90);

    writeVideoPosition("film:intro", 179, 180);
    expect(readVideoPosition("film:intro")).toBeNull();
  });

  it("positions of different materials do not interfere with each other", () => {
    writeVideoPosition("film:a", 30, 180);
    writeVideoPosition("film:b", 90, 180);
    expect(readVideoPosition("film:a")).toBe(30);
    expect(readVideoPosition("film:b")).toBe(90);
    clearVideoPosition("film:a");
    expect(readVideoPosition("film:a")).toBeNull();
    expect(readVideoPosition("film:b")).toBe(90);
  });

  it("an unknown duration does not prevent remembering the position", () => {
    expect(shouldRemember(60, Number.NaN)).toBe(true);
    expect(shouldRemember(60, 0)).toBe(true);
  });

  it("an unavailable localStorage does not crash the app", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("unavailable");
      },
      setItem: () => {
        throw new Error("unavailable");
      },
      removeItem: () => {
        throw new Error("unavailable");
      },
    });
    expect(() => writeVideoPosition("film:x", 60, 180)).not.toThrow();
    expect(readVideoPosition("film:x")).toBeNull();
    expect(() => clearVideoPosition("film:x")).not.toThrow();
  });
});

describe("which video a material shows", () => {
  const envelope = {
    _id: "article:x",
    schemaVersion: 1,
    title: "Protocol",
    sectionId: "section:test",
    tags: [],
    card: { color: "neutral" as const, cover: null },
    order: 1,
    createdBy: "test",
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedBy: "test",
    updatedAt: "2026-08-21T00:00:00.000Z",
    legacy: null,
  };
  const article = (video?: Article["video"]): Material =>
    ({
      ...envelope,
      type: "article",
      body: buildOutputData([eBlockParagraph("Protocol text.")]),
      plainText: "Protocol text.",
      excerpt: "Protocol text.",
      readingTime: 1,
      ...(video === undefined ? {} : { video }),
    }) as Material;

  it("an article without a video field — no video, nothing to show", () => {
    expect(videoOfMaterial(article())).toBeNull();
    expect(videoOfMaterial(article(null))).toBeNull();
  });

  it("an article with a video hands it to the player", () => {
    expect(videoOfMaterial(article({ path: "series/lesson-2.mp4" } as never))).toEqual({
      path: "series/lesson-2.mp4",
      durationSec: null,
      width: null,
      height: null,
      posterFrameSec: null,
    });
  });

  it("a historical string in an article means \"no video attached\", not a crash", () => {
    expect(videoOfMaterial(article("https://youtube.com/watch?v=x"))).toBeNull();
  });

  it("a form and a presentation have no video by construction", () => {
    const form = { ...envelope, type: "form", file: {}, plainText: "", excerpt: null } as unknown as Material;
    expect(videoOfMaterial(form)).toBeNull();
  });
});

describe("binding a video through the repository", () => {
  let contentDb: PouchDB.Database;
  let systemDb: PouchDB.Database;

  const section: Section = {
    _id: "section:test",
    type: "section",
    schemaVersion: 1,
    title: "Test section",
    slug: "test",
    description: "",
    macroCategory: "instructions",
    parentId: null,
    layout: "list",
    order: 1,
    cover: null,
    primaryTag: "test",
    legacy: { sourcePaths: [] },
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  };

  async function makeArticle(title: string) {
    return createMaterial({
      type: "article",
      sectionId: "section:test",
      title,
      body: buildOutputData([eBlockParagraph("Order of operations.")]),
      createdBy: "test",
    });
  }

  beforeEach(async () => {
    contentDb = createContentDb(NodePouchDB, createNodeDbOptions());
    systemDb = createSystemDb(NodePouchDB, createNodeDbOptions());
    await initRepository({ contentDb, systemDb, seed: false });
    await contentDb.put(section);
  });

  afterEach(async () => {
    await shutdownRepository();
    await contentDb.destroy().catch(() => undefined);
    await systemDb.destroy().catch(() => undefined);
  });

  it("a freshly created article has no video field at all — old documents read as before", async () => {
    const created = await makeArticle("Article without a video");
    const read = await getMaterialById(created._id);
    if (read?.type !== "article") throw new Error("expected article");
    expect("video" in read).toBe(false);
    expect(videoOfMaterial(read)).toBeNull();
  });

  it("editing an article without mentioning the video leaves it alone", async () => {
    const created = await makeArticle("Article being edited");
    await updateMaterial(created._id, {
      video: { path: "lesson-2.mp4", durationSec: null, width: null, height: null, posterFrameSec: null },
      updatedBy: "test",
    });
    const renamed = await updateMaterial(created._id, { title: "New title", updatedBy: "test" });
    expect(videoOfMaterial(renamed)?.path).toBe("lesson-2.mp4");
  });

  it("the binding is set and removed", async () => {
    const created = await makeArticle("Article with a video");

    const bound = await updateMaterial(created._id, {
      video: { path: "series/lesson-2.mp4", durationSec: 214, width: 1920, height: 1080, posterFrameSec: null },
      updatedBy: "test",
    });
    expect(videoOfMaterial(bound)).toEqual({
      path: "series/lesson-2.mp4",
      durationSec: 214,
      width: 1920,
      height: 1080,
      posterFrameSec: null,
    });

    const cleared = await updateMaterial(created._id, { video: null, updatedBy: "test" });
    expect(videoOfMaterial(cleared)).toBeNull();
    if (cleared.type !== "article") throw new Error("expected article");
    expect(cleared.video).toBeNull();
  });

  it("an unsafe path is rejected BEFORE writing to the database", async () => {
    const created = await makeArticle("Article with a bad path");

    for (const bad of ["../secret.mp4", "/etc/passwd", "C:/Windows/System32/x.mp4", "series/../../x.mp4"]) {
      await expect(
        updateMaterial(created._id, {
          video: { path: bad, durationSec: null, width: null, height: null, posterFrameSec: null },
          updatedBy: "test",
        }),
      ).rejects.toThrow(/videos/);
    }

    const read = await getMaterialById(created._id);
    if (read?.type !== "article") throw new Error("expected article");
    expect(videoOfMaterial(read)).toBeNull();
    expect(read._rev).toBe(created._rev);
  });

  it("a video cannot be bound by link — the historical string is read but never written", async () => {
    const created = await makeArticle("Article with a link");
    await expect(
      updateMaterial(created._id, { video: "https://youtube.com/watch?v=x", updatedBy: "test" }),
    ).rejects.toThrow(/videos/);
  });

  it("the video does not reach print: the printout with and without a video is the same", async () => {
    const created = await makeArticle("Article for printing");
    const before = await buildMaterialPrintHtml(created._id);

    await updateMaterial(created._id, {
      video: { path: "lesson-2.mp4", durationSec: 214, width: 1920, height: 1080, posterFrameSec: null },
      updatedBy: "test",
    });
    const after = await buildMaterialPrintHtml(created._id);

    expect(after?.html).toBe(before?.html);
    expect(after?.html).not.toContain("lesson-2.mp4");
    expect(after?.html).not.toContain("<video");
  });
});
