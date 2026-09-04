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
  return (
    id !== "seedstate" &&
    !id.startsWith("applog:") &&
    !id.startsWith("pin:") &&
    // Traces left by the server permission check. Found when the sync preview
    // window listed eight of them under "will appear on this computer": the
    // acceptance run leaves them on the server, and without this filter they
    // would spread across the centre's machines as if they were content.
    !id.startsWith("probe:") &&
    !id.startsWith("_design/")
  );
}

// --- Sync preview ---------------------------------------------------------

/**
 * What exactly happens to a document if "Sync" is pressed.
 *
 * `diverging` — both sides edited one document from a common ancestor, so the
 * revisions are of the same generation but different. Replication does not
 * "merge" that: it silently picks a winner by revision string. A person has to
 * learn about it BEFORE the sync, not discover afterwards that their edit lost.
 */
export type SyncChangeKind =
  | "incoming-new"
  | "incoming-updated"
  | "outgoing-new"
  | "outgoing-updated"
  | "diverging";

export interface SyncPreviewItem {
  id: string;
  /** The material title; for documents without one, a readable caption. */
  title: string;
  kind: SyncChangeKind;
  /** `article`, `form`, `section`, `user`, `settings`… — to tell materials from housekeeping. */
  docType: string;
  database: string;
}

export interface SyncPreviewDatabase {
  database: string;
  ok: boolean;
  /** Filled in only when the database could not be reached. */
  message?: string;
  counts: Record<SyncChangeKind, number>;
  /** The part of the list that is shown; the total is the sum of `counts`. */
  items: SyncPreviewItem[];
}

export interface SyncPreview {
  databases: SyncPreviewDatabase[];
  counts: Record<SyncChangeKind, number>;
  total: number;
  /** The list is not complete — there are more changes than the window holds. */
  truncated: boolean;
  /** At least one database was unreachable: the sync will probably not go through. */
  hasErrors: boolean;
}

export function emptyCounts(): Record<SyncChangeKind, number> {
  return {
    "incoming-new": 0,
    "incoming-updated": 0,
    "outgoing-new": 0,
    "outgoing-updated": 0,
    diverging: 0,
  };
}

/** Revision generation: for "3-abc…" it is 3. It grows with every edit. */
export function revGeneration(rev: string | undefined): number {
  const n = Number(String(rev ?? "").split("-")[0]);
  return Number.isFinite(n) ? n : 0;
}

/** Document type inferred from the id — without fetching the document itself. */
export function docTypeFromId(id: string): string {
  const prefix = id.split(":")[0];
  return id.includes(":") ? prefix : "other";
}

/** A material is what a person sees as an article or a form; the rest is housekeeping. */
export function isMaterialType(docType: string): boolean {
  return docType === "article" || docType === "form" || docType === "presentation" || docType === "film";
}

const PREVIEW_ITEM_LIMIT = 40;

/**
 * What a sync would change — WITHOUT the sync.
 *
 * It is computed by comparing lists of ids and revisions from both sides:
 * `allDocs` without documents returns only `id` and `rev`, so kilobytes travel
 * the network rather than a gigabyte of attachments. The revision generation
 * ("3-abc" -> 3) tells whose version is the descendant: the side that edited
 * last has the higher generation. An equal generation with different revisions
 * is a divergence, and it is shown separately.
 *
 * Titles are fetched only for the rows that fit in the window: a list of forty
 * names is useful to a person, a list of four hundred is not — and attachments
 * are not loaded at all.
 */
export async function previewSyncOnce(
  PouchCtor: new (name: string, options?: PouchDB.Configuration.DatabaseConfiguration) => PouchDB.Database,
  local: PouchDB.Database,
  remoteUrl: string,
  server: ReplicationServer,
): Promise<SyncPreviewDatabase> {
  const databaseName = (local as unknown as { name: string }).name;
  const remote = new PouchCtor(remoteUrl, {
    ...(server.username ? { auth: { username: server.username, password: server.password } } : {}),
  } as PouchDB.Configuration.DatabaseConfiguration);

  try {
    const [remoteAll, localAll] = await Promise.all([remote.allDocs(), local.allDocs()]);

    const remoteRevs = new Map<string, string>();
    for (const row of remoteAll.rows) {
      if (row.id && isReplicableDocId(row.id) && !row.value?.deleted) remoteRevs.set(row.id, row.value.rev);
    }
    const localRevs = new Map<string, string>();
    for (const row of localAll.rows) {
      if (row.id && isReplicableDocId(row.id) && !row.value?.deleted) localRevs.set(row.id, row.value.rev);
    }

    const counts = emptyCounts();
    const classified: { id: string; kind: SyncChangeKind }[] = [];

    for (const [id, remoteRev] of remoteRevs) {
      const localRev = localRevs.get(id);
      if (!localRev) {
        classified.push({ id, kind: "incoming-new" });
        continue;
      }
      if (localRev === remoteRev) continue;
      const rg = revGeneration(remoteRev);
      const lg = revGeneration(localRev);
      if (rg > lg) classified.push({ id, kind: "incoming-updated" });
      else if (lg > rg) classified.push({ id, kind: "outgoing-updated" });
      else classified.push({ id, kind: "diverging" });
    }
    for (const id of localRevs.keys()) {
      if (!remoteRevs.has(id)) classified.push({ id, kind: "outgoing-new" });
    }

    for (const c of classified) counts[c.kind] += 1;

    // Display order: first what changes on this person's machine, then the
    // divergences, then what leaves. That way the reason the window is shown
    // at all is the first thing they see.
    const order: SyncChangeKind[] = [
      "incoming-updated",
      "incoming-new",
      "diverging",
      "outgoing-updated",
      "outgoing-new",
    ];
    classified.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    const shown = classified.slice(0, PREVIEW_ITEM_LIMIT);

    const titles = await loadTitles(local, remote, shown);
    const items: SyncPreviewItem[] = shown.map((c) => ({
      id: c.id,
      kind: c.kind,
      database: databaseName,
      docType: titles.get(c.id)?.type ?? docTypeFromId(c.id),
      title: titles.get(c.id)?.title ?? describeDocId(c.id),
    }));

    return { database: databaseName, ok: true, counts, items };
  } catch (err) {
    const described = describeReplicationError(err, remoteUrl);
    return {
      database: databaseName,
      ok: false,
      message: described instanceof Error ? described.message : String(described),
      counts: emptyCounts(),
      items: [],
    };
  } finally {
    await (remote as unknown as { close?: () => Promise<void> }).close?.().catch(() => undefined);
  }
}

/**
 * Titles for the shown rows only. Local ones come from the local database,
 * incoming ones from the server; `include_docs` pulls the body but not the
 * attachments (those arrive as stubs), so forty documents are a few hundred
 * kilobytes.
 */
async function loadTitles(
  local: PouchDB.Database,
  remote: PouchDB.Database,
  shown: { id: string; kind: SyncChangeKind }[],
): Promise<Map<string, { title: string; type: string }>> {
  const out = new Map<string, { title: string; type: string }>();
  const fromRemote = shown.filter((c) => c.kind === "incoming-new").map((c) => c.id);
  const fromLocal = shown.filter((c) => c.kind !== "incoming-new").map((c) => c.id);

  async function take(db: PouchDB.Database, keys: string[]) {
    if (keys.length === 0) return;
    try {
      const res = await db.allDocs({ keys, include_docs: true } as PouchDB.Core.AllDocsOptions);
      for (const row of res.rows) {
        const doc = (row as {
          doc?: { title?: string; name?: string; displayName?: string; login?: string; type?: string };
        }).doc;
        if (!doc) continue;
        out.set(row.id, {
          // `displayName`/`login` are for user accounts: without them the
          // window showed "Account 01M15HDWQB1BR58KRVYDNBYS4D" — a ULID
          // instead of a person (spotted by eye during acceptance).
          title: doc.title ?? doc.displayName ?? doc.login ?? doc.name ?? describeDocId(row.id),
          type: doc.type ?? docTypeFromId(row.id),
        });
      }
    } catch {
      // Titles are decoration: without them the window shows ids, but it does
      // show. The preview must not fall over because of them.
    }
  }

  await Promise.all([take(local, fromLocal), take(remote, fromRemote)]);
  return out;
}

/** A readable caption for a document that has no title. */
export function describeDocId(id: string): string {
  if (id === REPLICATION_SETTINGS_ID) return "Sync settings";
  if (id.startsWith("user:")) return `Account ${id.slice("user:".length)}`;
  if (id.startsWith("settings:")) return `Settings: ${id.slice("settings:".length)}`;
  if (id.startsWith("section:")) return `Section ${id.slice("section:".length)}`;
  return id;
}

/**
 * A preview across both databases at once, in the same order as the sync
 * itself. One unreachable database does not stop the other from being shown:
 * the person sees both what would arrive and what is broken.
 */
export async function previewReplication(
  PouchCtor: new (name: string, options?: PouchDB.Configuration.DatabaseConfiguration) => PouchDB.Database,
  systemDb: PouchDB.Database,
  contentDb: PouchDB.Database,
  settings: ReplicationSettings,
): Promise<SyncPreview> {
  const server = activeServer(settings);
  if (!server) throw new ReplicationNotConfiguredError();
  const base = server.url.trim().replace(/\/+$/, "");

  const databases: SyncPreviewDatabase[] = [];
  for (const [db, remoteName] of [
    [systemDb, "aurora-system"],
    [contentDb, "aurora-content"],
  ] as const) {
    databases.push(await previewSyncOnce(PouchCtor, db, `${base}/${remoteName}`, server));
  }

  const counts = emptyCounts();
  for (const d of databases) {
    for (const k of Object.keys(counts) as SyncChangeKind[]) counts[k] += d.counts[k];
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const shownTotal = databases.reduce((a, d) => a + d.items.length, 0);

  return {
    databases,
    counts,
    total,
    truncated: shownTotal < total,
    hasErrors: databases.some((d) => !d.ok),
  };
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
