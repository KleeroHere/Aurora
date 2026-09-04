import { useState } from "react";
import { isTauriEnvironment } from "../../data/filePortSelect";
import { noUpdatesPort } from "../../data/updatePort";
import type { UpdateCheckResult, UpdatePort } from "../../data/updatePort";
import "./UpdateCheck.css";
import { humanError } from "../../utils/humanText";
import UpdateNotesModal from "./UpdateNotesModal";

async function selectUpdatePort(): Promise<UpdatePort> {
  if (!isTauriEnvironment()) return noUpdatesPort;
  const { tauriUpdatePort } = await import("../../data/updatePortTauri");
  return tauriUpdatePort;
}

export default function UpdateCheck() {
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  async function handleCheck() {
    setChecking(true);
    setError(null);
    setResult(null);
    setShowNotes(false);
    try {
      const port = await selectUpdatePort();
      setResult(await port.check());
    } finally {
      setChecking(false);
    }
  }

  async function handleInstall() {
    setInstalling(true);
    setError(null);
    setProgress(null);
    try {
      const port = await selectUpdatePort();
      await port.install(setProgress);
      setResult(null);
      setShowNotes(false);
    } catch (err) {
      setError(humanError(err));
      // The window closes so the error is visible: it is shown in the panel,
      // not underneath the modal.
      setShowNotes(false);
    } finally {
      setInstalling(false);
    }
  }

  return (
    <section className="update-check">
      <h3 className="update-check__title">App updates</h3>
      <p className="update-check__hint">
        The app never updates itself. Checking happens only via this button, and installation —
        only with your consent. If the update server is not around right now, the check will simply
        find nothing and this will not interfere with your work.
      </p>

      <button type="button" className="update-check__button" onClick={handleCheck} disabled={checking || installing}>
        {checking ? "Checking…" : "Check for updates"}
      </button>

      {result?.kind === "up-to-date" && <p className="update-check__report">You have the latest version.</p>}

      {result?.kind === "unavailable" && (
        <p className="update-check__report">
          Could not check — the update server is currently unavailable. Nothing is broken: the app
          keeps working as before; try again later.
        </p>
      )}

      {result?.kind === "available" && (
        <div className="update-check__offer">
          <p className="update-check__report">
            Version <strong>{result.update.version}</strong> is available (you have {result.update.currentVersion}).
          </p>
          <button
            type="button"
            className="update-check__button"
            onClick={() => setShowNotes(true)}
            disabled={installing}
          >
            {installing ? "Installing…" : "See what changed"}
          </button>
        </div>
      )}

      {/* Consent is given in a window with the release notes, not next to the
          button: a person has to see what is being installed before it is
          installed, not after. */}
      {showNotes && result?.kind === "available" && (
        <UpdateNotesModal
          version={result.update.version}
          currentVersion={result.update.currentVersion}
          notes={result.update.notes ?? ""}
          installing={installing}
          progress={progress}
          onConfirm={handleInstall}
          onCancel={() => setShowNotes(false)}
        />
      )}

      {error && <p className="update-check__error">Failed to update: {error}</p>}
    </section>
  );
}
