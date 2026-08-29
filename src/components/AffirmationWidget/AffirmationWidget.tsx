import { useEffect, useState } from "react";
import { isAffirmationHidden, loadAffirmations, pickAffirmationForDate, setAffirmationHidden } from "../../utils/affirmations";
import type { AffirmationEntry } from "../../utils/affirmations";
import Icon from "../icons/Icon";
import "./AffirmationWidget.css";

export default function AffirmationWidget() {
  const [hidden, setHidden] = useState(isAffirmationHidden);
  const [entry, setEntry] = useState<AffirmationEntry | null>(null);

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    loadAffirmations().then((entries) => {
      if (cancelled || !entries) return;
      const picked = pickAffirmationForDate(entries, new Date());
      if (!cancelled) setEntry(picked);
    });
    return () => {
      cancelled = true;
    };
  }, [hidden]);

  if (hidden || !entry) return null;

  function handleHide() {
    setAffirmationHidden(true);
    setHidden(true);
  }

  return (
    <div className="affirmation-widget surface-glass" data-help="home-affirmation">
      <div className="affirmation-widget__ribbon" aria-hidden="true" />
      <div className="affirmation-widget__body">
        <p className="affirmation-widget__eyebrow text-utility">Today only</p>
        <p className="affirmation-widget__text">{entry.text}</p>
      </div>
      <button
        type="button"
        className="affirmation-widget__hide"
        onClick={handleHide}
        title="Hide"
        aria-label="Hide the daily affirmation"
      >
        <Icon name="close" size={12} />
      </button>
    </div>
  );
}
