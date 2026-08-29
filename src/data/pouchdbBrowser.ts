import PouchDBCore from "pouchdb-core";
import idbAdapter from "pouchdb-adapter-idb";
import httpAdapter from "pouchdb-adapter-http";
import replication from "pouchdb-replication";
import find from "pouchdb-find";
import type { PouchDBConstructor } from "./db";

const BrowserPouchDBBase = PouchDBCore.plugin(idbAdapter)
  .plugin(httpAdapter)
  .plugin(replication)
  .plugin(find);

export const BrowserPouchDB = BrowserPouchDBBase as unknown as PouchDBConstructor;
