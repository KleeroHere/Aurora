import { SCHEMA_VERSION } from "./types";
import type { Change, Pin, User, UserPreferences } from "./types";
import { hashPassword, verifyPassword } from "./passwordHash";
import { ulid } from "./ulid";
import { assignTraining } from "./trainingProgress";

export const DEFAULT_SEED_PASSWORD = "aurora";
// Three demo accounts, one per role the centre actually has.
const SEED_LOGINS = [
  { login: "Alex", role: "consultant" },
  { login: "Sam", role: "senior consultant" },
  { login: "Robin", role: "programme director" },
] as const;

const USER_PREFIX = "user:";
const PIN_PREFIX = "pin:";
const CHANGE_PREFIX = "change:";

const ULID_PATTERN = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

function newUserId(): string {
  return `${USER_PREFIX}${ulid()}`;
}

export function isUlidUserId(id: string): boolean {
  return id.startsWith(USER_PREFIX) && ULID_PATTERN.test(id.slice(USER_PREFIX.length));
}

function loginKey(login: string): string {
  return login.trim().toLocaleLowerCase("en-US");
}

async function allDocsWithPrefix<T>(db: PouchDB.Database, prefix: string): Promise<T[]> {
  const result = await db.allDocs({
    include_docs: true,
    startkey: prefix,
    endkey: `${prefix}￿`,
  });
  return result.rows.map((row) => row.doc as unknown as T).filter(Boolean);
}

export async function listUsers(systemDb: PouchDB.Database): Promise<User[]> {
  const docs = await allDocsWithPrefix<User>(systemDb, USER_PREFIX);
  return docs.filter((doc): doc is User => (doc as unknown as { type?: string }).type === "user");
}

export async function findUserByLogin(systemDb: PouchDB.Database, login: string): Promise<User | null> {
  const key = loginKey(login);
  const matching = (await listUsers(systemDb))
    .filter((user) => loginKey(user.login) === key)
    .sort((a, b) => a._id.localeCompare(b._id));
  return matching[0] ?? null;
}

export async function seedUsersIfNeeded(systemDb: PouchDB.Database): Promise<{ created: number }> {
  let created = 0;
  const now = new Date().toISOString();

  const existing = new Set((await listUsers(systemDb)).map((user) => loginKey(user.login)));

  for (const { login, role } of SEED_LOGINS) {
    if (existing.has(loginKey(login))) continue;

    const doc: User = {
      _id: newUserId(),
      type: "user",
      schemaVersion: SCHEMA_VERSION,
      login,
      displayName: login,
      passwordHash: await hashPassword(DEFAULT_SEED_PASSWORD),
      role,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };
    await systemDb.put(doc);
    existing.add(loginKey(login));
    created++;
  }

  await assignDemoTraining(systemDb);
  return { created };
}

/**
 * In the demo, training is assigned to the consultant — and to nobody else.
 *
 * Training never switches itself on: a lead assigns it to a specific person
 * (see `isTrainingAssigned`). That is right for a real centre and useless for a
 * demo, where a visitor signing in would see no trace of the feature at all.
 *
 * So the seed does what a lead would do on someone's first day: it assigns the
 * course to Alex, the consultant. Sign in as Alex and the induction course
 * comes first; sign in as Sam or Robin and the handbook opens straight away, as
 * it does for anybody who has worked here a while.
 */
async function assignDemoTraining(systemDb: PouchDB.Database): Promise<void> {
  const users = await listUsers(systemDb);
  const newcomer = users.find((u) => loginKey(u.login) === loginKey("Alex"));
  const lead = users.find((u) => loginKey(u.login) === loginKey("Robin"));
  if (!newcomer) return;
  await assignTraining(systemDb, newcomer._id, lead?._id ?? newcomer._id).catch(() => undefined);
}

export interface LoginResult {
  user: User;
  usedDefaultPassword: boolean;
}

export async function verifyLogin(
  systemDb: PouchDB.Database,
  login: string,
  password: string,
): Promise<LoginResult | null> {
  const user = await findUserByLogin(systemDb, login);
  if (!user) return null;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  const usedDefaultPassword = await verifyPassword(DEFAULT_SEED_PASSWORD, user.passwordHash);

  await systemDb.put<User>({ ...user, lastLoginAt: new Date().toISOString() });

  return { user, usedDefaultPassword };
}

export async function changeUserPassword(
  systemDb: PouchDB.Database,
  userId: string,
  newPassword: string,
): Promise<void> {
  const user = await systemDb.get<User>(userId);
  await systemDb.put<User>({
    ...user,
    passwordHash: await hashPassword(newPassword),
    updatedAt: new Date().toISOString(),
  });
}

export async function updateUserPreferences(
  systemDb: PouchDB.Database,
  userId: string,
  patch: UserPreferences,
): Promise<User> {
  const user = await systemDb.get<User>(userId);
  const next: User = {
    ...user,
    preferences: { ...user.preferences, ...patch },
    updatedAt: new Date().toISOString(),
  };
  const result = await systemDb.put<User>(next);
  return { ...next, _rev: result.rev };
}

export class LoginTakenError extends Error {
  constructor(readonly login: string) {
    super(`The login "${login}" is already taken. Pick another one.`);
    this.name = "LoginTakenError";
  }
}

export async function createUser(
  systemDb: PouchDB.Database,
  login: string,
  displayName: string,
  password: string,
): Promise<User> {
  const trimmed = login.trim();
  if (trimmed.length === 0) {
    throw new Error("The login cannot be empty.");
  }
  if (await findUserByLogin(systemDb, trimmed)) {
    throw new LoginTakenError(trimmed);
  }
  const now = new Date().toISOString();
  const doc: User = {
    _id: newUserId(),
    type: "user",
    schemaVersion: SCHEMA_VERSION,
    login: trimmed,
    displayName: displayName.trim() || trimmed,
    passwordHash: await hashPassword(password),
    role: "consultant",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  };
  const result = await systemDb.put(doc);
  return { ...doc, _rev: result.rev };
}

export async function renameUserLogin(
  systemDb: PouchDB.Database,
  userId: string,
  newLogin: string,
): Promise<User> {
  const trimmed = newLogin.trim();
  if (trimmed.length === 0) {
    throw new Error("The login cannot be empty.");
  }
  const user = await systemDb.get<User>(userId);
  if (user.login === trimmed) return user;

  const taken = await findUserByLogin(systemDb, trimmed);
  if (taken && taken._id !== userId) {
    throw new LoginTakenError(trimmed);
  }

  const next: User = {
    ...user,
    login: trimmed,
    displayName: user.displayName === user.login ? trimmed : user.displayName,
    updatedAt: new Date().toISOString(),
  };
  const result = await systemDb.put<User>(next);
  return { ...next, _rev: result.rev };
}

export interface UserIdMigrationReport {
  migratedUsers: number;
  rewrittenPins: number;
  rewrittenChanges: number;
}

export async function migrateUserIdsToUlid(systemDb: PouchDB.Database): Promise<UserIdMigrationReport> {
  const empty: UserIdMigrationReport = { migratedUsers: 0, rewrittenPins: 0, rewrittenChanges: 0 };

  const users = await listUsers(systemDb);
  const legacy = users.filter((user) => !isUlidUserId(user._id));
  if (legacy.length === 0) return empty;

  const idByOldId = new Map<string, string>();
  const idByOldLogin = new Map<string, string>();
  const newUsers: User[] = [];

  for (const user of legacy) {
    const newId = newUserId();
    idByOldId.set(user._id, newId);
    idByOldLogin.set(loginKey(user.login), newId);
    const { _rev, ...withoutRev } = user;
    void _rev;
    newUsers.push({ ...withoutRev, _id: newId });
  }

  await bulkOrThrow(systemDb, newUsers, "accounts");

  const pins = await allDocsWithPrefix<Pin>(systemDb, PIN_PREFIX);
  const newPins: Pin[] = [];
  const oldPins: Pin[] = [];
  for (const pin of pins) {
    const newUserIdValue = idByOldId.get(pin.userId) ?? idByOldLogin.get(loginKey(pin.userId));
    if (!newUserIdValue) continue;
    const { _rev, ...withoutRev } = pin;
    void _rev;
    newPins.push({
      ...withoutRev,
      _id: `${PIN_PREFIX}${newUserIdValue}:${pin.materialId}`,
      userId: newUserIdValue,
    });
    oldPins.push(pin);
  }
  await bulkOrThrow(systemDb, newPins, "pins");

  const changes = await allDocsWithPrefix<Change>(systemDb, CHANGE_PREFIX);
  const updatedChanges: Change[] = [];
  for (const change of changes) {
    const newUserIdValue = idByOldId.get(change.userId) ?? idByOldLogin.get(loginKey(change.userId));
    if (!newUserIdValue || newUserIdValue === change.userId) continue;
    updatedChanges.push({ ...change, userId: newUserIdValue });
  }
  await bulkOrThrow(systemDb, updatedChanges, "change log");

  await bulkOrThrow(
    systemDb,
    [...oldPins, ...legacy].map((doc) => ({ ...doc, _deleted: true })),
    "deleting the old documents",
  );

  return {
    migratedUsers: legacy.length,
    rewrittenPins: newPins.length,
    rewrittenChanges: updatedChanges.length,
  };
}

async function bulkOrThrow(db: PouchDB.Database, docs: unknown[], what: string): Promise<void> {
  if (docs.length === 0) return;
  const results = await db.bulkDocs(docs as PouchDB.Core.PutDocument<Record<string, unknown>>[]);
  const failures = results.filter((row) => (row as PouchDB.Core.Error).error);
  if (failures.length > 0) {
    const first = failures[0] as PouchDB.Core.Error;
    throw new Error(
      `The account migration to ULID stopped at the "${what}" step: ` +
        `${failures.length} of ${docs.length} documents were not written (${first.id ?? "?"}: ${first.message ?? first.name}). ` +
        "The old documents were not deleted; signing in still works.",
    );
  }
}

export function buildUserDisplayNames(users: User[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const user of users) {
    map[user._id] = user.displayName;
    map[user.login] = user.displayName;
  }
  return map;
}
