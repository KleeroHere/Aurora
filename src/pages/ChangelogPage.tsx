import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadChangelog, markChangelogSeen } from "../utils/changelog";
import type { ChangelogEntry } from "../utils/changelog";
import "./ChangelogPage.css";

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadChangelog().then((loaded) => {
      if (cancelled) return;
      setEntries(loaded);
      if (loaded && loaded.length > 0) markChangelogSeen(loaded[0].version);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="changelog-page">
      <p className="changelog-page__eyebrow">Patch notes</p>
      <h1 className="changelog-page__title">All updates</h1>
      <Link to="/" className="changelog-page__back">
        Back to home
      </Link>

      {entries === null ? (
        <p className="changelog-page__hint">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="changelog-page__hint">No entries yet.</p>
      ) : (
        <ul className="changelog-page__list" data-help="changelog-list">
          {entries.map((entry) => (
            <li key={entry.version} className="changelog-page__entry surface-glass">
              <p className="changelog-page__version">
                Version {entry.version} · {entry.date}
              </p>
              <h2 className="changelog-page__entry-title">{entry.title}</h2>
              <ul className="changelog-page__entry-items">
                {entry.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
