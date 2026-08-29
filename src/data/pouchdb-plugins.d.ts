declare module "pouchdb-adapter-idb";
declare module "pouchdb-adapter-memory";
declare module "pouchdb-adapter-http";
declare module "pouchdb-replication";

declare module "*/tcp_proxy.mjs" {
  export function startTcpProxy(options: {
    listenPort?: number;
    targetHost?: string;
    targetPort: number;
  }): Promise<{
    port: number;
    url: string;
    state: { bytesToServer: number; bytesToClient: number; connections: number };
    close: () => Promise<void>;
  }>;
}

declare module "*/couch_local_server.mjs" {
  export function createStore(dataDir?: string): unknown;
  export function startCouchLocalServer(
    port?: number,
    options?: { store?: unknown },
  ): Promise<{ url: string; port: number; store: unknown; close: () => Promise<void> }>;
}
