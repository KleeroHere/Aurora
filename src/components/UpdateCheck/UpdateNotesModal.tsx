import { useEffect, useMemo, useRef } from "react";
import { useFocusTrap } from "../../utils/useFocusTrap";
import { parseNotes } from "./releaseNotes";
import "./UpdateNotesModal.css";

/**
 * What exactly is being installed — before it installs.
 *
 * Release notes always arrived inside `latest.json`, but they used to be shown
 * as one line next to the button: a long list crammed into a single paragraph
 * goes unread, and the person presses "yes" anyway. Now the install goes
 * through a window where the list is visible line by line, and the consent
 * applies to something that was actually read.
 *
 * The parsing is deliberately primitive: a line starting with "-" or "•" is a
 * list item, "# " is a heading, a blank line starts a paragraph. Dragging in a
 * markdown engine for a letter three paragraphs long is not worth it, and this
 * renders any text — including the old one-line note — without losing anything.
 */

export default function UpdateNotesModal({
  version,
  currentVersion,
  notes,
  installing,
  progress,
  onConfirm,
  onCancel,
}: {
  version: string;
  currentVersion: string;
  notes: string;
  installing: boolean;
  progress: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // While the install runs there is nothing to close: it cannot be stopped.
      if (event.key === "Escape" && !installing) onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, installing]);

  const blocks = useMemo(() => parseNotes(notes ?? ""), [notes]);

  return (
    <div
      className="update-notes-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Update to version ${version}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !installing) onCancel();
      }}
    >
      <div className="update-notes-modal__panel surface-glass-blur" ref={panelRef}>
        <h2 className="update-notes-modal__title">Update to version {version}</h2>
        <p className="update-notes-modal__version">Version {currentVersion} is installed now.</p>

        <div className="update-notes-modal__notes">
          {blocks.length === 0 && (
            <p className="update-notes-modal__paragraph">No description of the changes was attached.</p>
          )}
          {blocks.map((block, i) =>
            block.kind === "heading" ? (
              <h3 key={i} className="update-notes-modal__heading">
                {block.text}
              </h3>
            ) : block.kind === "list" ? (
              <ul key={i} className="update-notes-modal__list">
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            ) : (
              <p key={i} className="update-notes-modal__paragraph">
                {block.text}
              </p>
            ),
          )}
        </div>

        <p className="update-notes-modal__hint">
          Installing will close the app and start the installer. Materials and accounts are not
          touched — only the app itself is updated. Save whatever you are editing before you agree.
        </p>

        {installing && (
          <p className="update-notes-modal__progress" role="status">
            {progress === null ? "Downloading…" : `Downloaded ${Math.round(progress * 100)}%`}
          </p>
        )}

        <div className="update-notes-modal__actions">
          <button
            type="button"
            className="update-notes-modal__button update-notes-modal__button--secondary"
            onClick={onCancel}
            disabled={installing}
          >
            Not now
          </button>
          <button
            type="button"
            className="update-notes-modal__button update-notes-modal__button--primary"
            onClick={onConfirm}
            disabled={installing}
            autoFocus
          >
            {installing ? "Installing…" : "Install"}
          </button>
        </div>
      </div>
    </div>
  );
}
