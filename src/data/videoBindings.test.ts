import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import {
  VIDEO_BINDINGS_ID,
  emptyVideoBindingsDoc,
  loadVideoBindings,
  saveVideoBindings,
  videoForMaterial,
} from "./videoBindings";
import type { MaterialVideo } from "./types";

const CLIP: MaterialVideo = {
  path: "morning-circle.mp4",
  durationSec: 90.7,
  width: 1920,
  height: 1080,
  posterFrameSec: 3.5,
};
const OTHER: MaterialVideo = { ...CLIP, path: "another.mp4", durationSec: 12 };

const MAP = { "article:programme__opening-the-morning-circle": CLIP };
const ID = "article:programme__opening-the-morning-circle";

describe("which wins: the document field or the bindings table", () => {
  it("the document has no video key — take it from the table", () => {
    expect(videoForMaterial({ _id: ID }, MAP)).toEqual(CLIP);
  });

  it("the document has its own clip — that one wins", () => {
    const doc = { _id: ID, video: OTHER };
    expect(videoForMaterial(doc, MAP)).toEqual(OTHER);
  });

  it("somebody REMOVED the clip by hand — the table does not bring it back", () => {
    // The key is there with a null value: that is what the material panel writes
    // when a clip is removed. It is a person's decision, and the table must not
    // override it.
    const doc = { _id: ID, video: null };
    expect(videoForMaterial(doc, MAP)).toBeNull();
  });

  it("neither a key nor a row in the table — there is no clip", () => {
    expect(videoForMaterial({ _id: "article:programme__closing-the-day" }, MAP)).toBeNull();
    expect(videoForMaterial({ _id: ID }, {})).toBeNull();
  });

  it("the historical link form reads as “no clip”, not as a breakage", () => {
    const doc = { _id: ID, video: "https://example.com/watch" };
    expect(videoForMaterial(doc, MAP)).toBeNull();
  });
});

describe("the bindings table in the database", () => {
  let db: PouchDB.Database;
  let counter = 0;

  beforeEach(() => {
    counter += 1;
    db = new NodePouchDB(`video-bindings-${counter}`, createNodeDbOptions());
  });
  afterEach(async () => {
    await db.destroy().catch(() => undefined);
  });

  it("no table is a normal state, not an error", async () => {
    await expect(loadVideoBindings(db)).resolves.toEqual({});
  });

  it("saves and reads back", async () => {
    await saveVideoBindings(db, MAP);
    await expect(loadVideoBindings(db)).resolves.toEqual(MAP);
  });

  it("saving again updates rather than breeding a conflict", async () => {
    const first = await saveVideoBindings(db, MAP);
    const second = await saveVideoBindings(db, { ...MAP, "article:crisis__medical-emergency": OTHER });
    expect(second._rev).not.toBe(first._rev);
    const loaded = await loadVideoBindings(db);
    expect(Object.keys(loaded).sort()).toEqual([
      "article:crisis__medical-emergency",
      ID,
    ].sort());
  });

  it("lives under the id that gets imported at the centre", () => {
    expect(VIDEO_BINDINGS_ID).toBe("settings:video-bindings");
    expect(emptyVideoBindingsDoc()._id).toBe(VIDEO_BINDINGS_ID);
    // Type settings, not material: the table must not land in material lists
    // or in search.
    expect(emptyVideoBindingsDoc().type).toBe("settings");
  });
});
