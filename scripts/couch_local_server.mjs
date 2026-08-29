// Local CouchDB stand-in for tests: express-pouchdb speaks the real CouchDB
// HTTP protocol over an in-memory PouchDB, so replication tests run on any
// machine with no server installed. Point AURORA_COUCH_URL at a real
// CouchDB 3.x to run the same suite against the genuine implementation.
//
//
//
//
//
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
const require = createRequire(new URL("../package.json", import.meta.url));
const express = require("express");
const expressPouchDB = require("express-pouchdb");
const PouchDB = require("pouchdb");
const memoryAdapter = require("pouchdb-adapter-memory");

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

const PORT = Number(flag("--port", "5985"));
const DATA = flag("--data", null);

PouchDB.plugin(memoryAdapter);

export function createStore(dataDir = DATA) {
  return dataDir
    ? PouchDB.defaults({ prefix: dataDir.endsWith("/") ? dataDir : `${dataDir}/` })
    : PouchDB.defaults({ adapter: "memory" });
}

export function startCouchLocalServer(port = 0, options = {}) {
  const store = options.store ?? createStore();
  const app = express();
  app.use(
    "/",
    expressPouchDB(store, {
      logPath: `${tmpdir()}/aurora-couch-local.log`,
      configPath: `${tmpdir()}/aurora-couch-local.config.json`,
      mode: "minimumForPouchDB",
    }),
  );
  return new Promise((resolve) => {
    const server = app.listen(port, "127.0.0.1", () => {
      const { port: actual } = server.address();
      resolve({
        server,
        store,
        port: actual,
        url: `http://127.0.0.1:${actual}`,
        close: () =>
          new Promise((r) => {
            server.closeAllConnections?.();
            server.close(r);
          }),
      });
    });
  });
}
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const { url } = await startCouchLocalServer(PORT);
  console.log(`CouchDB-protocol server listening at ${url}`);
  console.log(`Storage: ${DATA ?? "in-memory (gone when the process exits)"}`);
  console.log("Stop with Ctrl+C.");
}
