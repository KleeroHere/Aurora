import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { hasUnreadChangelog, loadChangelog } from "../../utils/changelog";
import type { ChangelogEntry } from "../../utils/changelog";
import "./ChangelogWidget.css";

const PREVIEW_ITEMS = 3;

export default function ChangelogWidget() {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadChangelog().then((loaded) => {
      if (!cancelled) setEntries(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!entries || entries.length === 0) return null;

  const latest = entries[0];
  const unread = hasUnreadChangelog(entries);

  return (
    <div className="changelog-widget surface-glass" data-help="home-changelog">
      <div className="changelog-widget__head">
        <p className="changelog-widget__eyebrow text-utility">
          What's new
          {unread && <span className="changelog-widget__dot" aria-hidden="true" />}
        </p>
        <Link to="/changelog" className="changelog-widget__all">
          All updates
        </Link>
      </div>
      <p className="changelog-widget__version">
        Version {latest.version} · {latest.date}
      </p>
      <p className="changelog-widget__title">{latest.title}</p>
      <ul className="changelog-widget__items">
        {latest.items.slice(0, PREVIEW_ITEMS).map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
