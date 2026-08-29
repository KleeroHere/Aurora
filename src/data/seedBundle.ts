import { ulid } from "./ulid";
import { SCHEMA_VERSION } from "./types";
import type { AppLog, SeedState } from "./types";
import type { FilePort } from "./filePort";
import type { SeedPort } from "./seedPort";
import { decodeManifest } from "./dumpFormat";
import type { DumpManifest } from "./dumpFormat";
import { gunzipBytes } from "./gzip";
import { importContentDumpParts, writeBackupParts } from "./sync";
import { writeSystemBackup } from "./systemBackup";
import type { ImportProgress } from "./sync";
import { publishSeedProgress } from "./seedProgressBus";

export const SEED_STATE_ID = "seedstate";
export const SEED_MANIFEST_NAME = "bundle.manifest.json";
const DESIGN_DOC_PREFIX = "_design/";

export type SeedOutcome =
  | { status: "absent" } // no seed resource baked into this build (a regular browser/dev build without seed/)
  | { status: "already-seeded"; state: SeedState }
  | { status: "skipped-not-empty" }
  | { status: "seeded"; docCount: number }
  | { status: "failed"; error: string };

async function getExistingSeedState(systemDb: PouchDB.Database): Promise<SeedState | null> {
  try {
    return (await systemDb.get<SeedState>(SEED_STATE_ID)) as unknown as SeedState;
  } catch (err) {
    if ((err as PouchDB.Core.Error).status === 404) return null;
    throw err;
  }
}

async function contentDbHasRealDocs(contentDb: PouchDB.Database): Promise<boolean> {
  const result = await contentDb.allDocs();
  return result.rows.some((row) => !row.id.startsWith(DESIGN_DOC_PREFIX));
}

async function putSeedState(
  systemDb: PouchDB.Database,
  patch: Omit<SeedState, "_id" | "type" | "schemaVersion">,
): Promise<void> {
  const existing = await getExistingSeedState(systemDb);
  const doc: SeedState = {
    _id: SEED_STATE_ID,
    ...(existing?._rev ? { _rev: existing._rev } : {}),
    type: "seedstate",
    schemaVersion: SCHEMA_VERSION,
    ...patch,
  };
  await systemDb.put(doc as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);
}

async function logSeedEvent(
  systemDb: PouchDB.Database,
  level: AppLog["level"],
  context: Record<string, unknown>,
): Promise<void> {
  try {
    await systemDb.put<Omit<AppLog, "_id">>({
      _id: `applog:${ulid()}`,
      type: "applog",
      schemaVersion: SCHEMA_VERSION,
      level,
      event: "seed.bundle",
      context,
      at: new Date().toISOString(),
    } as AppLog);
  } catch {
  }
}

async function* readSeedParts(
  seedPort: SeedPort,
  manifest: DumpManifest,
  onFileRead: (fileIndex: number) => void,
): AsyncGenerator<Uint8Array> {
  for (let i = 0; i < manifest.parts.length; i += 1) {
    const gz = await seedPort.readSeedResource(manifest.parts[i].file);
    const bytes = await gunzipBytes(gz);
    onFileRead(i + 1);
    yield bytes;
  }
}

export async function seedFromBundleIfNeeded(
  contentDb: PouchDB.Database,
  systemDb: PouchDB.Database,
  filePort: FilePort,
  seedPort: SeedPort,
): Promise<SeedOutcome> {
  publishSeedProgress({ phase: "idle" });

  const hasResource = await seedPort.hasSeedResource();
  if (!hasResource) return { status: "absent" };

  const existingState = await getExistingSeedState(systemDb);
  const resuming = existingState?.status === "in-progress";
  if (existingState && !resuming) {
    return { status: "already-seeded", state: existingState };
  }
  if (resuming) {
    await logSeedEvent(systemDb, "warn", {
      reason: "resume-after-interrupted-seed",
      interruptedAt: existingState?.seededAt ?? null,
    });
  }

  if (!resuming && (await contentDbHasRealDocs(contentDb))) {
    await putSeedState(systemDb, {
      status: "skipped-not-empty",
      bundleCreatedAt: null,
      bundleDocCount: null,
      seededAt: new Date().toISOString(),
      error: null,
    });
    await logSeedEvent(systemDb, "info", { reason: "content-db-not-empty" });
    return { status: "skipped-not-empty" };
  }

  try {
    const manifestBytes = await seedPort.readSeedResource(SEED_MANIFEST_NAME);
    const manifest = decodeManifest(manifestBytes);

    if (manifest.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(
        `The seed bundle was built for schemaVersion ${manifest.schemaVersion}, the app runs ` +
          `schemaVersion ${SCHEMA_VERSION} — seeding cancelled.`,
      );
    }

    await putSeedState(systemDb, {
      status: "in-progress",
      bundleCreatedAt: manifest.createdAt,
      bundleDocCount: manifest.totalDocCount,
      seededAt: new Date().toISOString(),
      error: null,
    });

    let filesRead = 0;
    const onProgress = (progress: ImportProgress) => {
      publishSeedProgress({ phase: "seeding", progress });
    };

    const parts = readSeedParts(seedPort, manifest, (n) => {
      filesRead = n;
    });

    const report = await importContentDumpParts(
      contentDb,
      systemDb,
      parts,
      manifest.parts.length,
      async (dump) => {
        try {
          await writeBackupParts(filePort, "aurora-seed-preseed-backup.json", dump);
          await writeSystemBackup(filePort, systemDb, "aurora-seed-preseed-system-backup.json");
        } catch (err) {
          await logSeedEvent(systemDb, "warn", {
            stage: "pre-seed-backup",
            skipped: true,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
      onProgress,
      () => manifest.totalDocCount,
    );
    void filesRead; // only keeps the generator above readable; the actual count lives in report

    await putSeedState(systemDb, {
      status: "seeded",
      bundleCreatedAt: manifest.createdAt,
      bundleDocCount: manifest.totalDocCount,
      seededAt: new Date().toISOString(),
      error: null,
    });
    await logSeedEvent(systemDb, "info", { merged: report.merged, created: report.created });
    publishSeedProgress({ phase: "done" });
    return { status: "seeded", docCount: report.merged };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await putSeedState(systemDb, {
        status: "failed",
        bundleCreatedAt: null,
        bundleDocCount: null,
        seededAt: new Date().toISOString(),
        error: message,
      });
      await logSeedEvent(systemDb, "error", { error: message });
    } catch {
    }
    publishSeedProgress({ phase: "error", message });
    return { status: "failed", error: message };
  }
}
