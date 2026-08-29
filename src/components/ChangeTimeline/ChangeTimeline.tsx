import type { AppLog, Change } from "../../data/types";
import { enrichWithMoves, groupByDay, TIMELINE_OP_LABELS, TIMELINE_OP_COLOR_VAR } from "../../utils/changeTimeline";
import { resolveGlyphColorKey } from "../../utils/glyphParams";
import "./ChangeTimeline.css";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function ChangeTimeline({
  entries,
  appLog,
  userDisplayNames,
}: {
  entries: Change[];
  appLog: AppLog[];
  userDisplayNames: Record<string, string>;
}) {
  const enriched = enrichWithMoves(entries, appLog);
  const groups = groupByDay(enriched);

  if (groups.length === 0) {
    return <p className="change-timeline__empty">No entries.</p>;
  }

  return (
    <div className="change-timeline">
      {groups.map((group) => (
        <details key={group.key} className="change-timeline__day" open={!group.collapsedByDefault}>
          <summary className="change-timeline__day-header">
            {group.label}
            <span className="change-timeline__day-count">{group.entries.length}</span>
          </summary>
          <ol className="change-timeline__list">
            {group.entries.map((entry) => {
              const colorKey = resolveGlyphColorKey(entry.userId, "neutral");
              const displayName = userDisplayNames[entry.userId] ?? entry.userId;
              return (
                <li key={entry._id} className="change-timeline__item">
                  <span
                    className="change-timeline__avatar"
                    style={{
                      backgroundImage: `linear-gradient(135deg, var(--glyph-pair-${colorKey}-from), var(--glyph-pair-${colorKey}-to))`,
                    }}
                    aria-hidden="true"
                  >
                    {displayName.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span
                    className="change-timeline__badge"
                    style={{ backgroundColor: `var(${TIMELINE_OP_COLOR_VAR[entry.displayOp]})` }}
                    aria-hidden="true"
                  />
                  <div className="change-timeline__body">
                    <p className="change-timeline__text">
                      <strong>{displayName}</strong> {TIMELINE_OP_LABELS[entry.displayOp]} "{entry.targetTitle}"
                    </p>
                    <time className="change-timeline__time" dateTime={entry.at}>
                      {formatTime(entry.at)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        </details>
      ))}
    </div>
  );
}
