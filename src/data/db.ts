
export type PouchDBConstructor = new (
  name: string,
  options?: PouchDB.Configuration.DatabaseConfiguration,
) => PouchDB.Database;

export const CONTENT_DB_NAME = "content";
export const SYSTEM_DB_NAME = "system";

export function createContentDb(
  PouchDBCtor: PouchDBConstructor,
  options: PouchDB.Configuration.DatabaseConfiguration = {},
): PouchDB.Database {
  return new PouchDBCtor(CONTENT_DB_NAME, options);
}

export function createSystemDb(
  PouchDBCtor: PouchDBConstructor,
  options: PouchDB.Configuration.DatabaseConfiguration = {},
): PouchDB.Database {
  return new PouchDBCtor(SYSTEM_DB_NAME, options);
}

export async function ensureContentIndexes(db: PouchDB.Database): Promise<void> {
  await db.createIndex({
    index: {
      fields: ["sectionId", "order"],
      name: "idx_material_section_order",
      ddoc: "idx_material_section_order",
    },
  });
  await db.createIndex({
    index: {
      fields: ["updatedAt"],
      name: "idx_material_updated",
      ddoc: "idx_material_updated",
    },
  });
}

export async function ensureSystemIndexes(db: PouchDB.Database): Promise<void> {
  await db.createIndex({
    index: {
      fields: ["targetId", "at"],
      name: "idx_change_target_at",
      ddoc: "idx_change_target_at",
    },
  });
}
