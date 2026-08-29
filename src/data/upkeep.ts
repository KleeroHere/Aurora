import { SCHEMA_VERSION } from "./types";

export const UPKEEP_STATE_ID = "settings:upkeep";

export const UPKEEP_INTERVAL_DAYS = 7;

export interface UpkeepState {
  _id: string;
  _rev?: string;
  type: "settings";
  schemaVersion: number;
  lastRunAt: string | null;
  lastPrunedAppLog: number;
  updatedAt: string;
}

export function emptyUpkeepState(): UpkeepState {
  return {
    _id: UPKEEP_STATE_ID,
    type: "settings",
    schemaVersion: SCHEMA_VERSION,
    lastRunAt: null,
    lastPrunedAppLog: 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadUpkeepState(systemDb: PouchDB.Database): Promise<UpkeepState> {
  try {
    const doc = await systemDb.get<UpkeepState>(UPKEEP_STATE_ID);
    return { ...emptyUpkeepState(), ...doc };
  } catch (err) {
    if ((err as PouchDB.Core.Error).status === 404) return emptyUpkeepState();
    throw err;
  }
}

export function isUpkeepDue(state: UpkeepState, now: Date = new Date()): boolean {
  if (!state.lastRunAt) return true;
  const last = new Date(state.lastRunAt);
  if (Number.isNaN(last.getTime())) return true;
  const days = (now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000);
  return days >= UPKEEP_INTERVAL_DAYS;
}

export interface UpkeepResult {
  ran: boolean;
  prunedAppLog: number;
  compacted: string[];
}

export interface UpkeepDeps {
  contentDb: PouchDB.Database;
  systemDb: PouchDB.Database;
  pruneAppLog: () => Promise<number>;
  now?: Date;
  force?: boolean;
}

export async function runDatabaseUpkeep(deps: UpkeepDeps): Promise<UpkeepResult> {
  const { contentDb, systemDb, pruneAppLog, now = new Date(), force = false } = deps;
  const result: UpkeepResult = { ran: false, prunedAppLog: 0, compacted: [] };

  try {
    const state = await loadUpkeepState(systemDb);
    if (!force && !isUpkeepDue(state, now)) return result;

    result.prunedAppLog = await pruneAppLog();

    for (const [name, db] of [
      ["content", contentDb],
      ["system", systemDb],
    ] as const) {
      await db.compact();
      result.compacted.push(name);
    }

    const next: UpkeepState = {
      ...state,
      lastRunAt: now.toISOString(),
      lastPrunedAppLog: result.prunedAppLog,
      updatedAt: now.toISOString(),
    };
    await systemDb.put(next as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);
    result.ran = true;
    return result;
  } catch {
    return result;
  }
}
