import { SCHEMA_VERSION } from "./types";
import type { Pin } from "./types";

export const MAX_PINS = 5;

function pinId(userId: string, materialId: string): string {
  return `pin:${userId}:${materialId}`;
}

const userMutex = new Map<string, Promise<void>>();

function runExclusive<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const previous = userMutex.get(userId) ?? Promise.resolve();
  const result = previous.then(task, task);
  userMutex.set(
    userId,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );
  return result;
}

export async function listPins(systemDb: PouchDB.Database, userId: string): Promise<Pin[]> {
  const prefix = `pin:${userId}:`;
  const result = await systemDb.allDocs({
    include_docs: true,
    startkey: prefix,
    endkey: `${prefix}￿`,
  });
  return result.rows
    .map((row) => row.doc as unknown as Pin)
    .filter((doc): doc is Pin => Boolean(doc && (doc as unknown as { type?: string }).type === "pin"))
    .sort((a, b) => a.order - b.order);
}

export async function isPinned(systemDb: PouchDB.Database, userId: string, materialId: string): Promise<boolean> {
  try {
    await systemDb.get(pinId(userId, materialId));
    return true;
  } catch (err) {
    if ((err as PouchDB.Core.Error).status === 404) return false;
    throw err;
  }
}

export async function pinMaterial(systemDb: PouchDB.Database, userId: string, materialId: string): Promise<Pin> {
  return runExclusive(userId, async () => {
    const existing = await listPins(systemDb, userId);
    const already = existing.find((p) => p.materialId === materialId);
    if (already) return already;

    if (existing.length >= MAX_PINS) {
      throw new Error(`You can pin at most ${MAX_PINS} materials. Unpin something first.`);
    }

    const order = existing.reduce((max, p) => Math.max(max, p.order), 0) + 1;
    const doc: Pin = {
      _id: pinId(userId, materialId),
      type: "pin",
      schemaVersion: SCHEMA_VERSION,
      userId,
      materialId,
      order,
      createdAt: new Date().toISOString(),
    };
    await systemDb.put(doc);
    return doc;
  });
}

export async function unpinMaterial(systemDb: PouchDB.Database, userId: string, materialId: string): Promise<void> {
  return runExclusive(userId, async () => {
    try {
      const doc = await systemDb.get(pinId(userId, materialId));
      await systemDb.remove(doc);
    } catch (err) {
      if ((err as PouchDB.Core.Error).status === 404) return;
      throw err;
    }
  });
}
