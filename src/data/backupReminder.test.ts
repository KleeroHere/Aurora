import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import { createSystemDb } from "./db";
import {
  BACKUP_STATE_ID,
  REMIND_AFTER_DAYS,
  checkReminder,
  emptyBackupState,
  formatBackupMoment,
  loadBackupState,
  markBackupDone,
  reminderText,
} from "./backupReminder";

const NOW = new Date("2026-08-11T03:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("reminder threshold logic", () => {
  it("no backups at all - remind about both", () => {
    const verdict = checkReminder(emptyBackupState(), NOW);
    expect(verdict.due).toBe(true);
    expect(verdict.kinds.sort()).toEqual(["content", "system"]);
  });

  it("fresh backups - no reminder", () => {
    const verdict = checkReminder(
      { ...emptyBackupState(), lastContentBackupAt: daysAgo(3), lastSystemBackupAt: daysAgo(1) },
      NOW,
    );
    expect(verdict.due).toBe(false);
    expect(reminderText(verdict)).toBeNull();
  });

  it("exactly at the threshold - already reminding", () => {
    const verdict = checkReminder(
      {
        ...emptyBackupState(),
        lastContentBackupAt: daysAgo(REMIND_AFTER_DAYS),
        lastSystemBackupAt: daysAgo(0),
      },
      NOW,
    );
    expect(verdict.due).toBe(true);
    expect(verdict.kinds).toEqual(["content"]);
  });

  it("one day before the threshold - still silent", () => {
    const verdict = checkReminder(
      {
        ...emptyBackupState(),
        lastContentBackupAt: daysAgo(REMIND_AFTER_DAYS - 1),
        lastSystemBackupAt: daysAgo(REMIND_AFTER_DAYS - 1),
      },
      NOW,
    );
    expect(verdict.due).toBe(false);
  });

  it("only one backup overdue - mention only that one", () => {
    const verdict = checkReminder(
      { ...emptyBackupState(), lastContentBackupAt: daysAgo(2), lastSystemBackupAt: daysAgo(200) },
      NOW,
    );
    expect(verdict.kinds).toEqual(["system"]);
    expect(reminderText(verdict)).toContain("accounts");
    expect(reminderText(verdict)).not.toContain("materials backup");
  });

  it("a corrupted timestamp counts as missing instead of breaking the check", () => {
    const verdict = checkReminder({ ...emptyBackupState(), lastContentBackupAt: "not a date" }, NOW);
    expect(verdict.due).toBe(true);
    expect(verdict.daysSince.content).toBeNull();
  });

  it("reminder text explains what to do without scaring", () => {
    const text = reminderText(checkReminder(emptyBackupState(), NOW));
    expect(text).toContain("Time to save a backup");
    expect(text).toContain("takes a minute");
    expect(text).not.toMatch(/loss|danger|urgent/i);
  });
});

describe("human-friendly date", () => {
  it("today and yesterday - as words", () => {
    expect(formatBackupMoment(daysAgo(0), NOW)).toBe("today");
    expect(formatBackupMoment(daysAgo(1), NOW)).toBe("yesterday");
  });

  it("older moments - as a date", () => {
    expect(formatBackupMoment(daysAgo(40), NOW)).toMatch(/\d{4}/);
  });

  it("no backup yet - says exactly that", () => {
    expect(formatBackupMoment(null, NOW)).toBe("not made yet");
  });
});

describe("timestamp in the system database", () => {
  let systemDb: PouchDB.Database;

  beforeEach(() => {
    systemDb = createSystemDb(NodePouchDB, createNodeDbOptions());
  });

  afterEach(async () => {
    await systemDb.destroy().catch(() => undefined);
  });

  it("empty database - empty state, not an error", async () => {
    const state = await loadBackupState(systemDb);
    expect(state.lastContentBackupAt).toBeNull();
    expect(state._id).toBe(BACKUP_STATE_ID);
  });

  it("timestamp survives a state reload", async () => {
    await markBackupDone(systemDb, "content", daysAgo(0));
    const reloaded = await loadBackupState(systemDb);
    expect(reloaded.lastContentBackupAt).toBeTruthy();
    expect(reloaded.lastSystemBackupAt).toBeNull();
  });

  it("the two backup kinds do not overwrite each other", async () => {
    await markBackupDone(systemDb, "content", daysAgo(5));
    await markBackupDone(systemDb, "system", daysAgo(1));
    const state = await loadBackupState(systemDb);
    expect(state.lastContentBackupAt).toBe(daysAgo(5));
    expect(state.lastSystemBackupAt).toBe(daysAgo(1));
  });

  it("reminder disappears after a backup", async () => {
    await markBackupDone(systemDb, "content", daysAgo(90));
    await markBackupDone(systemDb, "system", daysAgo(90));
    expect(checkReminder(await loadBackupState(systemDb), NOW).due).toBe(true);

    await markBackupDone(systemDb, "content", daysAgo(0));
    await markBackupDone(systemDb, "system", daysAgo(0));
    expect(checkReminder(await loadBackupState(systemDb), NOW).due).toBe(false);
  });
});
