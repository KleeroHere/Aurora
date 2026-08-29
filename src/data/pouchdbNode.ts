import PouchDBCore from "pouchdb-core";
import memoryAdapter from "pouchdb-adapter-memory";
import httpAdapter from "pouchdb-adapter-http";
import replication from "pouchdb-replication";
import find from "pouchdb-find";
import type { PouchDBConstructor } from "./db";

const NodePouchDBBase = PouchDBCore.plugin(memoryAdapter)
  .plugin(httpAdapter)
  .plugin(replication)
  .plugin(find);

export const NodePouchDB = NodePouchDBBase as unknown as PouchDBConstructor;

export function createNodeDbOptions(): PouchDB.Configuration.DatabaseConfiguration {
  return { adapter: "memory" };
}
