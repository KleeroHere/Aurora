import type { AppLog, Change } from "../data/types";
import { formatLongDate } from "./dateFormat";

export type TimelineOp = Change["op"] | "move";

export interface TimelineEntry extends Change {
  displayOp: TimelineOp;
}

const MOVE_CORRELATION_WINDOW_MS = 2000;

export function enrichWithMoves(changes: Change[], appLog: AppLog[]): TimelineEntry[] {
  const moveEvents = appLog.filter((entry) => entry.event === "material.section_moved");
  return changes.map((change) => {
    if (change.op !== "update") {
      return { ...change, displayOp: change.op };
    }
    const changeTime = new Date(change.at).getTime();
    const matched = moveEvents.some((event) => {
      const context = event.context as { materialId?: unknown };
      if (context.materialId !== change.targetId) return false;
      return Math.abs(new Date(event.at).getTime() - changeTime) <= MOVE_CORRELATION_WINDOW_MS;
    });
    return { ...change, displayOp: matched ? "move" : "update" };
  });
}

export const TIMELINE_OP_LABELS: Record<TimelineOp, string> = {
  create: "created",
  update: "edited",
  delete: "deleted",
  move: "moved to another section",
};

export const TIMELINE_OP_COLOR_VAR: Record<TimelineOp, string> = {
  create: "--color-success",
  update: "--color-accent",
  delete: "--color-danger",
  move: "--aurora-violet",
};

export interface DayGroup {
  key: string;
  label: string;
  entries: TimelineEntry[];
  collapsedByDefault: boolean;
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function groupByDay(entries: TimelineEntry[], now: Date = new Date()): DayGroup[] {
  const todayKey = dateKey(now.toISOString());
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = dateKey(yesterdayDate.toISOString());
  const weekAgoDate = new Date(now);
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);

  const byKey = new Map<string, TimelineEntry[]>();
  for (const entry of entries) {
    const key = dateKey(entry.at);
    const list = byKey.get(key) ?? [];
    list.push(entry);
    byKey.set(key, list);
  }

  return [...byKey.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([key, dayEntries]) => {
      let label: string;
      if (key === todayKey) label = "Today";
      else if (key === yesterdayKey) label = "Yesterday";
      else label = formatLongDate(dayEntries[0].at);
      return {
        key,
        label,
        entries: dayEntries,
        collapsedByDefault: new Date(dayEntries[0].at) < weekAgoDate,
      };
    });
}
