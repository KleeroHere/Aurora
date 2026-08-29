import { describe, expect, it } from "vitest";
import { enrichWithMoves, groupByDay } from "./changeTimeline";
import type { AppLog, Change } from "../data/types";

function localIso(year: number, monthIndex: number, day: number, hour = 9): string {
  return new Date(year, monthIndex, day, hour).toISOString();
}

function change(overrides: Partial<Change>): Change {
  return {
    _id: `change:${Math.random()}`,
    type: "change",
    schemaVersion: 1,
    targetId: "material:1",
    targetType: "article",
    targetTitle: "Material",
    op: "update",
    userId: "anton",
    at: localIso(2026, 6, 31),
    ...overrides,
  };
}

function appLog(overrides: Partial<AppLog>): AppLog {
  return {
    _id: `applog:${Math.random()}`,
    type: "applog",
    schemaVersion: 1,
    level: "info",
    event: "material.section_moved",
    context: {},
    at: localIso(2026, 6, 31),
    ...overrides,
  };
}

describe("enrichWithMoves", () => {
  it("marks an update as a move when targetId matches and an applog entry is close in time", () => {
    const changeAt = new Date(2026, 6, 31, 10, 0, 1).toISOString();
    const logAt = new Date(2026, 6, 31, 10, 0, 0).toISOString();
    const changes = [change({ targetId: "material:1", at: changeAt })];
    const log = [appLog({ context: { materialId: "material:1" }, at: logAt })];
    const result = enrichWithMoves(changes, log);
    expect(result[0].displayOp).toBe("move");
  });

  it("does not mark as a move when materialId differs", () => {
    const changes = [change({ targetId: "material:1" })];
    const log = [appLog({ context: { materialId: "material:2" } })];
    expect(enrichWithMoves(changes, log)[0].displayOp).toBe("update");
  });

  it("does not mark as a move when the applog event is too far in time", () => {
    const changeAt = new Date(2026, 6, 31, 10, 0, 0).toISOString();
    const logAt = new Date(2026, 6, 31, 10, 5, 0).toISOString();
    const changes = [change({ targetId: "material:1", at: changeAt })];
    const log = [appLog({ context: { materialId: "material:1" }, at: logAt })];
    expect(enrichWithMoves(changes, log)[0].displayOp).toBe("update");
  });

  it("create/delete pass through as is, untouched by the move heuristic", () => {
    const changes = [change({ op: "create" }), change({ op: "delete" })];
    const log = [appLog({ context: { materialId: "material:1" } })];
    const result = enrichWithMoves(changes, log);
    expect(result.map((r) => r.displayOp)).toEqual(["create", "delete"]);
  });
});

describe("groupByDay", () => {
  const now = new Date(2026, 6, 31, 12, 0, 0);

  it("groups by calendar day and labels Today/Yesterday/date", () => {
    const entries = enrichWithMoves(
      [
        change({ at: localIso(2026, 6, 31) }),
        change({ at: localIso(2026, 6, 30) }),
        change({ at: localIso(2026, 6, 20) }),
      ],
      [],
    );
    const groups = groupByDay(entries, now);
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "July 20, 2026"]);
  });

  it("newer days come first", () => {
    const entries = enrichWithMoves(
      [change({ at: localIso(2026, 6, 20) }), change({ at: localIso(2026, 6, 31) })],
      [],
    );
    const groups = groupByDay(entries, now);
    expect(groups[0].key > groups[1].key).toBe(true);
  });

  it("days older than a week are collapsed by default, recent ones are not", () => {
    const entries = enrichWithMoves(
      [change({ at: localIso(2026, 6, 31) }), change({ at: localIso(2026, 6, 1) })],
      [],
    );
    const groups = groupByDay(entries, now);
    const recent = groups.find((g) => g.key === "2026-07-31")!;
    const old = groups.find((g) => g.key === "2026-07-01")!;
    expect(recent.collapsedByDefault).toBe(false);
    expect(old.collapsedByDefault).toBe(true);
  });
});
