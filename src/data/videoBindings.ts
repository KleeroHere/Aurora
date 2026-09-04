import { SCHEMA_VERSION } from "./types";
import type { Material, MaterialVideo } from "./types";
import { normalizeVideo } from "./videoPort";

/**
 * The table of video bindings — a document of its own, rather than a field
 * inside each article.
 *
 * WHY IT WAS NEEDED. The binding used to live as a `video` field inside the
 * article document, and that ran into the way content is delivered: a file
 * import merges DOCUMENTS into the database, and the mechanism cannot replace a
 * single field. Shipping seventeen bindings to the centre would have meant
 * sending them seventeen of our articles — overwriting the edits they had been
 * making in those articles all month. The other way round (take their export
 * first, add the field, send it back) needs a round trip with real people and
 * access to their database, which does not exist before the first sync.
 *
 * The table removes all of that: it is one document, it touches no article, it
 * weighs a couple of dozen kilobytes, and it is delivered by the same import
 * without any risk to somebody else's edits. Later batches of videos travel the
 * same way.
 *
 * WHICH ONE WINS. The field on the document beats the table, and that is not a
 * detail: a video can be attached or removed by hand from the material's own
 * panel, and the table must not override a person's decision. The rule is
 * exact: **if the document HAS a `video` key, use it — even when it holds
 * `null`** ("somebody removed the video"); no key at all means take it from the
 * table. So a machine whose articles have never heard of the key gets its
 * videos, and a video somebody removed by hand does not come back on its own.
 *
 * The document lives in the CONTENT database and travels with a sync like any
 * material.
 */

export const VIDEO_BINDINGS_ID = "settings:video-bindings";

export type VideoBindingsMap = Record<string, MaterialVideo>;

export interface VideoBindingsDoc {
  _id: string;
  _rev?: string;
  type: "settings";
  schemaVersion: number;
  /** Material id → video. */
  bindings: VideoBindingsMap;
  updatedAt: string;
}

export function emptyVideoBindingsDoc(): VideoBindingsDoc {
  return {
    _id: VIDEO_BINDINGS_ID,
    type: "settings",
    schemaVersion: SCHEMA_VERSION,
    bindings: {},
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Which video to show for a material.
 *
 * A pure function: the map is passed in, so it can be held in one place instead
 * of hitting the database for every card in a list.
 */
export function videoForMaterial(
  doc: Pick<Material, "_id"> & { video?: MaterialVideo | string | null },
  bindings: VideoBindingsMap,
): MaterialVideo | null {
  // The key exists — the decision was made at document level, the table is silent.
  if ("video" in doc) return normalizeVideo(doc.video);
  return normalizeVideo(bindings[doc._id]);
}

export async function loadVideoBindings(contentDb: PouchDB.Database): Promise<VideoBindingsMap> {
  try {
    const doc = await contentDb.get<VideoBindingsDoc>(VIDEO_BINDINGS_ID);
    return doc.bindings ?? {};
  } catch (err) {
    // No table is a normal state: on a machine where it has never been imported,
    // bindings come from the document fields, as they used to.
    if ((err as PouchDB.Core.Error).status === 404) return {};
    throw err;
  }
}

export async function saveVideoBindings(
  contentDb: PouchDB.Database,
  bindings: VideoBindingsMap,
): Promise<VideoBindingsDoc> {
  let current: VideoBindingsDoc;
  try {
    current = await contentDb.get<VideoBindingsDoc>(VIDEO_BINDINGS_ID);
  } catch (err) {
    if ((err as PouchDB.Core.Error).status !== 404) throw err;
    current = emptyVideoBindingsDoc();
  }
  const next: VideoBindingsDoc = { ...current, bindings, updatedAt: new Date().toISOString() };
  const result = await contentDb.put(next as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);
  return { ...next, _rev: result.rev };
}
