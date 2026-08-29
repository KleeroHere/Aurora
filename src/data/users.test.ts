import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import { createSystemDb } from "./db";
import {
  DEFAULT_SEED_PASSWORD,
  buildUserDisplayNames,
  changeUserPassword,
  createUser,
  findUserByLogin,
  isUlidUserId,
  listUsers,
  migrateUserIdsToUlid,
  renameUserLogin,
  seedUsersIfNeeded,
  verifyLogin,
} from "./users";
import { hashPassword } from "./passwordHash";

let systemDb: PouchDB.Database;

beforeEach(() => {
  systemDb = createSystemDb(NodePouchDB, createNodeDbOptions());
});

afterEach(async () => {
  await systemDb.destroy().catch(() => undefined);
});

describe("seedUsersIfNeeded", () => {
  it("creates the three bundled users on first launch", async () => {
    const result = await seedUsersIfNeeded(systemDb);
    expect(result.created).toBe(3);
    const users = await listUsers(systemDb);
    expect(users.map((u) => u.login).sort()).toEqual(["Alex", "Robin", "Sam"]);
  });

  it("idempotent — a repeat run creates nothing", async () => {
    await seedUsersIfNeeded(systemDb);
    const second = await seedUsersIfNeeded(systemDb);
    expect(second.created).toBe(0);
    expect((await listUsers(systemDb)).length).toBe(3);
  });

  it("everyone's default password is not stored in plain text", async () => {
    await seedUsersIfNeeded(systemDb);
    const users = await listUsers(systemDb);
    for (const user of users) {
      expect(user.passwordHash).not.toContain(DEFAULT_SEED_PASSWORD);
      expect(user.passwordHash.length).toBeGreaterThan(0);
    }
  });
});

describe("verifyLogin", () => {
  beforeEach(async () => {
    await seedUsersIfNeeded(systemDb);
  });

  it("correct login and the default password — successful sign-in, usedDefaultPassword=true", async () => {
    const result = await verifyLogin(systemDb, "Robin", DEFAULT_SEED_PASSWORD);
    expect(result).not.toBeNull();
    expect(result?.user.login).toBe("Robin");
    expect(result?.usedDefaultPassword).toBe(true);
  });

  it("wrong password — null, no exception", async () => {
    const result = await verifyLogin(systemDb, "Robin", "wrong-pass");
    expect(result).toBeNull();
  });

  it("nonexistent login — null, no exception", async () => {
    const result = await verifyLogin(systemDb, "NoSuchUser", "anything");
    expect(result).toBeNull();
  });

  it("a successful sign-in updates lastLoginAt", async () => {
    const before = await findUserByLogin(systemDb, "Robin");
    expect(before!.lastLoginAt).toBeNull();

    await verifyLogin(systemDb, "Robin", DEFAULT_SEED_PASSWORD);

    const after = await findUserByLogin(systemDb, "Robin");
    expect(after!.lastLoginAt).not.toBeNull();
  });

  it("after a password change the default no longer works, usedDefaultPassword=false for the new one", async () => {
    const robin = await findUserByLogin(systemDb, "Robin");
    await changeUserPassword(systemDb, robin!._id, "new-strong-pass");

    const withOldPassword = await verifyLogin(systemDb, "Robin", DEFAULT_SEED_PASSWORD);
    expect(withOldPassword).toBeNull();

    const withNewPassword = await verifyLogin(systemDb, "Robin", "new-strong-pass");
    expect(withNewPassword?.usedDefaultPassword).toBe(false);
  });
});

describe("createUser", () => {
  it("creates a new user; signing in with the given password works", async () => {
    const created = await createUser(systemDb, "NewConsultant", "New Consultant", "secret-pass");
    expect(created.login).toBe("NewConsultant");

    const result = await verifyLogin(systemDb, "NewConsultant", "secret-pass");
    expect(result).not.toBeNull();
  });

  it("rejects creation with an already taken login", async () => {
    await createUser(systemDb, "Dup", "First", "x");
    await expect(createUser(systemDb, "Dup", "Second", "y")).rejects.toThrow();
  });

  it("login uniqueness is checked ignoring case and whitespace", async () => {
    await createUser(systemDb, "Alex", "First", "x");
    await expect(createUser(systemDb, "  alex ", "Second", "y")).rejects.toThrow(/taken/);
  });

  it("the _id of a new account is a ULID, not the login", async () => {
    const created = await createUser(systemDb, "Ulidnyy", "Ulid", "x");
    expect(isUlidUserId(created._id)).toBe(true);
    expect(created._id).not.toContain("Ulidnyy");
  });
});

describe("renaming a login (the reason _id became a ULID)", () => {
  it("the login changes, the _id stays the same — nothing loses its link", async () => {
    const created = await createUser(systemDb, "Staryi", "Old", "pass");
    const renamed = await renameUserLogin(systemDb, created._id, "Novyi");

    expect(renamed._id).toBe(created._id);
    expect(renamed.login).toBe("Novyi");
    expect(await verifyLogin(systemDb, "Novyi", "pass")).not.toBeNull();
    expect(await verifyLogin(systemDb, "Staryi", "pass")).toBeNull();
  });

  it("the display name follows the login only when it matched it", async () => {
    const same = await createUser(systemDb, "Rovno", "Rovno", "x");
    expect((await renameUserLogin(systemDb, same._id, "Drugoy")).displayName).toBe("Drugoy");

    const custom = await createUser(systemDb, "Tehnicheskiy", "Robin Lee", "x");
    expect((await renameUserLogin(systemDb, custom._id, "Maria")).displayName).toBe("Robin Lee");
  });

  it("renaming to an already taken login is rejected, the old login keeps working", async () => {
    await createUser(systemDb, "Zanyat", "First", "x");
    const second = await createUser(systemDb, "Svobodnyi", "Second", "y");

    await expect(renameUserLogin(systemDb, second._id, "zanyat")).rejects.toThrow(/taken/);
    expect(await verifyLogin(systemDb, "Svobodnyi", "y")).not.toBeNull();
  });

  it("renaming to the same login — no error and no extra revision", async () => {
    const created = await createUser(systemDb, "Tot", "Tot", "x");
    const same = await renameUserLogin(systemDb, created._id, "Tot");
    expect(same._rev).toBe(created._rev);
  });
});

describe("migration user:<login> -> user:<ULID>", () => {
  async function seedLegacyDatabase(): Promise<void> {
    const now = new Date().toISOString();
    await systemDb.bulkDocs([
      {
        _id: "user:Alex",
        type: "user",
        schemaVersion: 3,
        login: "Alex",
        displayName: "Alex",
        passwordHash: await hashPassword("old-pass"),
        role: "consultant",
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
      },
      {
        _id: "pin:user:Alex:material:abc",
        type: "pin",
        schemaVersion: 3,
        userId: "user:Alex",
        materialId: "material:abc",
        order: 1,
        createdAt: now,
      },
      {
        _id: "change:01AAAAAAAAAAAAAAAAAAAAAAAA",
        type: "change",
        schemaVersion: 3,
        targetId: "material:abc",
        targetType: "article",
        targetTitle: "New teammate onboarding",
        op: "update",
        userId: "Alex",
        at: now,
      },
    ] as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>[]);
  }

  it("moves the account to a ULID; signing in works with the same password", async () => {
    await seedLegacyDatabase();

    const report = await migrateUserIdsToUlid(systemDb);
    expect(report.migratedUsers).toBe(1);

    const user = await findUserByLogin(systemDb, "Alex");
    expect(user).not.toBeNull();
    expect(isUlidUserId(user!._id)).toBe(true);
    expect(await verifyLogin(systemDb, "Alex", "old-pass")).not.toBeNull();
  });

  it("the old user:<login> document is deleted — no duplicate Alexes remain", async () => {
    await seedLegacyDatabase();
    await migrateUserIdsToUlid(systemDb);

    await expect(systemDb.get("user:Alex")).rejects.toMatchObject({ status: 404 });
    expect((await listUsers(systemDb)).filter((u) => u.login === "Alex")).toHaveLength(1);
  });

  it("the change log keeps its link: the entry points at the new _id", async () => {
    await seedLegacyDatabase();
    const report = await migrateUserIdsToUlid(systemDb);
    expect(report.rewrittenChanges).toBe(1);

    const user = await findUserByLogin(systemDb, "Alex");
    const change = await systemDb.get<{ userId: string }>("change:01AAAAAAAAAAAAAAAAAAAAAAAA");
    expect(change.userId).toBe(user!._id);
  });

  it("the pin moves to the new key and exactly one remains", async () => {
    await seedLegacyDatabase();
    const report = await migrateUserIdsToUlid(systemDb);
    expect(report.rewrittenPins).toBe(1);

    const user = await findUserByLogin(systemDb, "Alex");
    const pins = await systemDb.allDocs({ startkey: "pin:", endkey: "pin:￿", include_docs: true });
    expect(pins.rows).toHaveLength(1);
    expect(pins.rows[0].id).toBe(`pin:${user!._id}:material:abc`);
    expect((pins.rows[0].doc as unknown as { userId: string }).userId).toBe(user!._id);
  });

  it("idempotent: a repeat run touches nothing", async () => {
    await seedLegacyDatabase();
    await migrateUserIdsToUlid(systemDb);

    const second = await migrateUserIdsToUlid(systemDb);
    expect(second).toEqual({ migratedUsers: 0, rewrittenPins: 0, rewrittenChanges: 0 });
    expect((await listUsers(systemDb)).length).toBe(1);
  });

  it("on an already new database (ULID seed) does nothing", async () => {
    await seedUsersIfNeeded(systemDb);
    const report = await migrateUserIdsToUlid(systemDb);
    expect(report.migratedUsers).toBe(0);
    expect((await listUsers(systemDb)).length).toBe(3);
  });

  it("after the migration the bundled seed does NOT create a second Alex", async () => {
    await seedLegacyDatabase();
    await migrateUserIdsToUlid(systemDb);
    await seedUsersIfNeeded(systemDb);

    const alexes = (await listUsers(systemDb)).filter((u) => u.login === "Alex");
    expect(alexes).toHaveLength(1);
    expect(await verifyLogin(systemDb, "Alex", "old-pass")).not.toBeNull();
  });
});

describe("buildUserDisplayNames", () => {
  it("knows a person both by _id and by login — old log entries get labeled too", async () => {
    const user = await createUser(systemDb, "Robin", "Robin Lee", "x");
    const names = buildUserDisplayNames(await listUsers(systemDb));

    expect(names[user._id]).toBe("Robin Lee");
    expect(names["Robin"]).toBe("Robin Lee");
  });
});
