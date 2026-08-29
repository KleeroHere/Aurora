import { useEffect, useState } from "react";
import { brandIdentity } from "../../context/brandIdentity";
import { paletteFromStorage } from "../../context/ThemeContext";
import { getSeedProgress, onSeedProgressChange } from "../../data/seedProgressBus";
import type { SeedProgressState } from "../../data/seedProgressBus";
import "./DbBootSplash.css";

const LONG_WAIT_MS = 3000;

function formatSeedHint(state: SeedProgressState): string | null {
  if (state.phase === "seeding") {
    const { progress } = state;
    const action = progress.phase === "reading" ? "Reading seed data" : "Populating the database";
    const fileCounter = `part ${progress.fileIndex} of ${progress.totalFiles}`;
    if (progress.phase === "merging" && progress.totalDocsHint !== null) {
      return `${action}: ${fileCounter} — ${progress.docsMergedSoFar} of ${progress.totalDocsHint} documents`;
    }
    return `${action}: ${fileCounter}`;
  }
  if (state.phase === "error") {
    return "Failed to load the initial database content — the app will open with an empty database.";
  }
  return null;
}

export default function DbBootSplash() {
  const [longWait, setLongWait] = useState(false);
  const [seedState, setSeedState] = useState<SeedProgressState>(getSeedProgress());

  useEffect(() => {
    const timer = window.setTimeout(() => setLongWait(true), LONG_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => onSeedProgressChange(setSeedState), []);

  const seedHint = formatSeedHint(seedState);

  return (
    <div className="db-boot-splash">
      <img src={brandIdentity(paletteFromStorage()).auroraMark} alt="Aurora" className="db-boot-splash__mark" />
      {seedHint ? (
        <p className="db-boot-splash__hint">{seedHint}</p>
      ) : (
        longWait && <p className="db-boot-splash__hint">Loading is taking longer than usual…</p>
      )}
    </div>
  );
}
