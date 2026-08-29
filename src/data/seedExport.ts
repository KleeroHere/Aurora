import { writeBackupStream } from "./sync";
import { DEFAULT_MAX_DUMP_PART_BYTES } from "./dumpFormat";
import type { FilePort } from "./filePort";
import { SCHEMA_VERSION } from "./types";
import { ulid } from "./ulid";

export const SEED_EXPORT_BASE_NAME = "aurora-seed-export.json";

export interface SeedExportResult {
  docCount: number;
  parts: number;
  baseName: string;
}

export async function exportSeedBundle(
  filePort: FilePort,
  contentDb: PouchDB.Database,
  systemDb: PouchDB.Database,
  maxPartBytes: number = DEFAULT_MAX_DUMP_PART_BYTES,
): Promise<SeedExportResult> {
  const written = await writeBackupStream(filePort, SEED_EXPORT_BASE_NAME, contentDb, maxPartBytes);

  await systemDb.put({
    _id: `applog:${ulid()}`,
    type: "applog",
    schemaVersion: SCHEMA_VERSION,
    level: "info",
    event: "seed.export",
    context: { docCount: written.docCount, parts: written.partCount },
    at: new Date().toISOString(),
  } as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);

  return { docCount: written.docCount, parts: written.partCount, baseName: SEED_EXPORT_BASE_NAME };
}
