import { SCHEMA_VERSION } from "./types";

export const REPLICATION_SETTINGS_ID = "settings:replication";

export interface ReplicationServer {
  id: "primary" | "fallback";
  label: string;
  url: string;
  username: string;
  password: string;
}

export interface LastSyncRecord {
  at: string;
  database: string;
  ok: boolean;
  docsRead: number;
  docsWritten: number;
  conflicts: number;
  message: string;
}

export interface ReplicationSettings {
  _id: string;
  _rev?: string;
  type: "settings";
  schemaVersion: number;
  servers: ReplicationServer[];
  activeServerId: ReplicationServer["id"];
  lastSync: LastSyncRecord[];
  updatedAt: string;
}

export function defaultReplicationSettings(): ReplicationSettings {
  return {
    _id: REPLICATION_SETTINGS_ID,
    type: "settings",
    schemaVersion: SCHEMA_VERSION,
    servers: [
      { id: "primary", label: "Primary server", url: "", username: "", password: "" },
      { id: "fallback", label: "Temporary hub", url: "", username: "", password: "" },
    ],
    activeServerId: "primary",
    lastSync: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function loadReplicationSettings(systemDb: PouchDB.Database): Promise<ReplicationSettings> {
  try {
    const doc = await systemDb.get<ReplicationSettings>(REPLICATION_SETTINGS_ID);
    const base = defaultReplicationSettings();
    return {
      ...base,
      ...doc,
      servers: base.servers.map((d) => doc.servers?.find((s) => s.id === d.id) ?? d),
      lastSync: doc.lastSync ?? [],
    };
  } catch (err) {
    if ((err as PouchDB.Core.Error).status === 404) return defaultReplicationSettings();
    throw err;
  }
}

export async function saveReplicationSettings(
  systemDb: PouchDB.Database,
  patch: Partial<Omit<ReplicationSettings, "_id" | "_rev" | "type" | "schemaVersion">>,
): Promise<ReplicationSettings> {
  const current = await loadReplicationSettings(systemDb);
  const next: ReplicationSettings = { ...current, ...patch, updatedAt: new Date().toISOString() };
  const result = await systemDb.put(next as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);
  return { ...next, _rev: result.rev };
}

export async function probeServer(
  server: ReplicationServer,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; message: string }> {
  const base = server.url.trim().replace(/\/+$/, "");
  if (!base) return { ok: false, message: "The server address is not set." };
  const headers: Record<string, string> = {};
  if (server.username) {
    headers.Authorization = "Basic " + btoa(`${server.username}:${server.password}`);
  }
  try {
    const res = await fetchImpl(`${base}/_up`, { headers, signal: AbortSignal.timeout(8000) });
    if (res.ok) return { ok: true, message: "The server responds; the name and password were accepted." };
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message:
          "The server responds — the connection is fine. But it did not accept the name or password " +
          "of the technical account: check them in the fields above.",
      };
    }
    return { ok: false, message: `The server responds, but with error ${res.status}. Sync will most likely fail.` };
  } catch {
    return {
      ok: false,
      message:
        "The server is not responding. Check that it is turned on, that Tailscale is running on both " +
        "machines, and that the address is correct (machine name, not IP).",
    };
  }
}

export function activeServer(settings: ReplicationSettings): ReplicationServer | null {
  const server = settings.servers.find((s) => s.id === settings.activeServerId);
  return server && server.url.trim() ? server : null;
}

export class ReplicationNotConfiguredError extends Error {
  constructor() {
    super(
      'The server address is not set. Open "Sync", enter the server address ' +
        "and try again. Until an address is set, the app works as it always has — " +
        "fully, just on its own.",
    );
    this.name = "ReplicationNotConfiguredError";
  }
}

export class ReplicationUnreachableError extends Error {
  constructor(
    readonly url: string,
    readonly cause?: unknown,
  ) {
    super(
      `Server ${url} is not responding. This is not a breakage: the app works without it. ` +
        "Check that the server is on and the network is up, then click again — " +
        "an unfinished sync will continue from where it left off.",
    );
    this.name = "ReplicationUnreachableError";
  }
}

export class ReplicationAuthError extends Error {
  constructor(
    readonly url: string,
    readonly cause?: unknown,
  ) {
    super(
      `Server ${url} did not accept the name or password. Check them in "Sync" — ` +
        "this is the server's separate technical account, not your app sign-in.",
    );
    this.name = "ReplicationAuthError";
  }
}

export class ReplicationForbiddenError extends ReplicationAuthError {
  constructor(
    url: string,
    readonly detail: string,
    cause?: unknown,
  ) {
    super(url, cause);
    this.message =
      `Server ${url} accepted the name and password but did not grant permission for this operation` +
      (detail ? ` (${detail})` : "") +
      ". Retyping the password is pointless — the technical account's permissions " +
      "must be fixed on the server itself.";
    this.name = "ReplicationForbiddenError";
  }
}

const RIGHTS_NOT_PASSWORD = /not a server admin|not allowed to access|forbidden|insufficient|unauthorized to access/i;

export function describeReplicationError(err: unknown, url: string): Error {
  const status = (err as { status?: number }).status;
  const name = (err as { name?: string }).name ?? "";
  const message = (err as { message?: string }).message ?? String(err);
  const reason = (err as { reason?: string }).reason ?? "";
  const said = `${reason} ${message} ${name}`;

  if (status === 403) return new ReplicationForbiddenError(url, reason || message, err);
  if (status === 401) {
    return RIGHTS_NOT_PASSWORD.test(said)
      ? new ReplicationForbiddenError(url, reason || message, err)
      : new ReplicationAuthError(url, err);
  }
  if (
    status === 0 ||
    status === undefined ||
    /Failed to fetch|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network|getaddrinfo/i.test(`${name} ${message}`)
  ) {
    return new ReplicationUnreachableError(url, err);
  }
  return new Error(`Server ${url} responded with an error: ${message}`);
}

export interface SyncOutcome {
  database: string;
  ok: boolean;
  docsRead: number;
  docsWritten: number;
  conflicts: number;
  rejected: string[];
  message: string;
}

export function isReplicableDocId(id: string): boolean {
  return id !== "seedstate" && !id.startsWith("applog:") && !id.startsWith("pin:") && !id.startsWith("_design/");
}

export interface SyncOptions {
  batchSize?: number;
  timeoutMs?: number;
}

export async function syncOnce(
  PouchCtor: new (name: string, options?: PouchDB.Configuration.DatabaseConfiguration) => PouchDB.Database,
  local: PouchDB.Database,
  remoteUrl: string,
  server: ReplicationServer,
  options: SyncOptions = {},
): Promise<SyncOutcome> {
  const databaseName = (local as unknown as { name: string }).name;
  const remote = new PouchCtor(remoteUrl, {
    ...(server.username
      ? { auth: { username: server.username, password: server.password } }
      : {}),
    ...({} as PouchDB.Configuration.DatabaseConfiguration),
  } as PouchDB.Configuration.DatabaseConfiguration);

  const conflicts: string[] = [];
  const rejected: string[] = [];
  let docsRead = 0;
  let docsWritten = 0;

  try {
    const result = await (
      local as unknown as {
        sync: (
          remote: PouchDB.Database,
          opts: Record<string, unknown>,
        ) => Promise<{
          push: { docs_read: number; docs_written: number; doc_write_failures: number; errors: unknown[] };
          pull: { docs_read: number; docs_written: number; doc_write_failures: number; errors: unknown[] };
        }>;
      }
    ).sync(remote, {
      batch_size: options.batchSize ?? 10,
      batches_limit: 1,
      retry: false,
      filter: (doc: { _id: string }) => isReplicableDocId(doc._id),
    });

    for (const side of [result.push, result.pull]) {
      docsRead += side.docs_read ?? 0;
      docsWritten += side.docs_written ?? 0;
      for (const e of side.errors ?? []) {
        const id = (e as { id?: string }).id ?? "?";
        if ((e as { name?: string }).name === "conflict") conflicts.push(id);
        else rejected.push(id);
      }
    }

    const conflicted = await countConflicts(local);

    return {
      database: databaseName,
      ok: rejected.length === 0,
      docsRead,
      docsWritten,
      conflicts: conflicted,
      rejected,
      message:
        rejected.length === 0
          ? `Sync finished: received ${docsRead}, sent ${docsWritten}.`
          : `Sync finished with rejections: the server refused ${rejected.length} document(s).`,
    };
  } catch (err) {
    throw describeReplicationError(err, remoteUrl);
  } finally {
    await (remote as unknown as { close?: () => Promise<void> }).close?.().catch(() => undefined);
  }
}

export async function countConflicts(db: PouchDB.Database): Promise<number> {
  const result = await db.allDocs({ include_docs: true, conflicts: true } as PouchDB.Core.AllDocsOptions);
  return result.rows.filter((row) => {
    const doc = row.doc as unknown as { _conflicts?: string[] } | undefined;
    return Boolean(doc?._conflicts?.length);
  }).length;
}

export async function runReplication(
  PouchCtor: new (name: string, options?: PouchDB.Configuration.DatabaseConfiguration) => PouchDB.Database,
  systemDb: PouchDB.Database,
  contentDb: PouchDB.Database,
  settings: ReplicationSettings,
  options: SyncOptions = {},
): Promise<SyncOutcome[]> {
  const server = activeServer(settings);
  if (!server) throw new ReplicationNotConfiguredError();

  const base = server.url.trim().replace(/\/+$/, "");
  const outcomes: SyncOutcome[] = [];

  for (const [db, remoteName] of [
    [systemDb, "aurora-system"],
    [contentDb, "aurora-content"],
  ] as const) {
    try {
      outcomes.push(await syncOnce(PouchCtor, db, `${base}/${remoteName}`, server, options));
    } catch (err) {
      outcomes.push({
        database: (db as unknown as { name: string }).name,
        ok: false,
        docsRead: 0,
        docsWritten: 0,
        conflicts: 0,
        rejected: [],
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return outcomes;
}

export function toLastSyncRecords(outcomes: SyncOutcome[]): LastSyncRecord[] {
  const at = new Date().toISOString();
  return outcomes.map((o) => ({
    at,
    database: o.database,
    ok: o.ok,
    docsRead: o.docsRead,
    docsWritten: o.docsWritten,
    conflicts: o.conflicts,
    message: o.message,
  }));
}
