import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CHANGE_LOG_PAGE_SIZE,
  exportChangeLogToFile,
  getAppLog,
  getChangeLog,
  getUserDisplayNames,
} from "../data/repository";
import type { AppLog, Change } from "../data/types";
import ChangeTimeline from "../components/ChangeTimeline/ChangeTimeline";
import "./AdminJournalPage.css";
import { humanError } from "../utils/humanText";

const PAGE_SIZE = 50;

type OpFilter = "" | Change["op"];

export default function AdminJournalPage() {
  const [entries, setEntries] = useState<Change[]>([]);
  const [appLog, setAppLog] = useState<AppLog[]>([]);
  const [userDisplayNames, setUserDisplayNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [userFilter, setUserFilter] = useState("");
  const [opFilter, setOpFilter] = useState<OpFilter>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [exportStatus, setExportStatus] = useState<"idle" | "saving" | "saved" | "cancelled" | "error">("idle");
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getChangeLog(), getAppLog()])
      .then(([changes, log]) => {
        setEntries(changes);
        setAppLog(log);
      })
      .finally(() => setLoading(false));
    getUserDisplayNames().then(setUserDisplayNames);
  }, []);

  const users = useMemo(() => Array.from(new Set(entries.map((e) => e.userId))).sort(), [entries]);

  function displayNameFor(userId: string): string {
    return userDisplayNames[userId] ?? userId;
  }

  function matchesFilters(e: Change): boolean {
    if (userFilter && e.userId !== userFilter) return false;
    if (opFilter && e.op !== opFilter) return false;
    const day = e.at.slice(0, 10);
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    return true;
  }

  const filtered = useMemo(
    () => entries.filter(matchesFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, userFilter, opFilter, dateFrom, dateTo],
  );

  useEffect(() => {
    setPage(1);
  }, [userFilter, opFilter, dateFrom, dateTo]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageEntries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleExport() {
    setExportStatus("saving");
    setExportError(null);
    try {
      const whole = await getChangeLog(0);
      const saved = await exportChangeLogToFile(whole.filter(matchesFilters));
      setExportStatus(saved ? "saved" : "cancelled"); // null = user cancelled the save dialog
    } catch (err) {
      setExportStatus("error");
      setExportError(humanError(err));
    }
  }

  return (
    <div className="admin-journal-page">
      <p className="admin-journal-page__eyebrow">Admin</p>
      <h1 className="admin-journal-page__title">Change log — full list</h1>
      <Link to="/admin" className="admin-journal-page__back">
        Back to admin page
      </Link>

      <div className="admin-journal-page__filters" data-help="journal-list">
        <label className="admin-journal-page__filter">
          User
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">All</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {displayNameFor(u)}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-journal-page__filter">
          Edit type
          <select value={opFilter} onChange={(e) => setOpFilter(e.target.value as OpFilter)}>
            <option value="">All</option>
            <option value="create">Created</option>
            <option value="update">Updated</option>
            <option value="delete">Deleted</option>
          </select>
        </label>
        <label className="admin-journal-page__filter">
          From
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="admin-journal-page__filter">
          To
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
      </div>

      <div className="admin-journal-page__toolbar">
        <span className="admin-journal-page__count">
          Entries: {filtered.length}
          {entries.length >= CHANGE_LOG_PAGE_SIZE && (
            <span className="admin-journal-page__count-note">
              {" "}
              — showing the latest {CHANGE_LOG_PAGE_SIZE}; exporting to a file saves the whole log
            </span>
          )}
        </span>
        <button
          type="button"
          className="admin-journal-page__button"
          onClick={handleExport}
          disabled={exportStatus === "saving" || filtered.length === 0}
        >
          {exportStatus === "saving" ? "Saving…" : "Export filtered log"}
        </button>
      </div>
      {exportStatus === "saved" && <p className="admin-journal-page__notice">Log file saved.</p>}
      {exportStatus === "error" && <p className="admin-journal-page__error">Save error: {exportError}</p>}

      {loading ? (
        <p className="admin-journal-page__hint">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="admin-journal-page__hint">No entries match the current filters.</p>
      ) : (
        <>
          <ChangeTimeline entries={pageEntries} appLog={appLog} userDisplayNames={userDisplayNames} />
          {pageCount > 1 && (
            <div className="admin-journal-page__pagination">
              <button
                type="button"
                className="admin-journal-page__button admin-journal-page__button--secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                className="admin-journal-page__button admin-journal-page__button--secondary"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
