import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "../../utils/useFocusTrap";
import "./ImportConfirmModal.css";

const CONFIRM_WORD = "REPLACE";

export default function ImportConfirmModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  const canConfirm = input === CONFIRM_WORD;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onCancel();
  }

  return (
    <div
      className="import-confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Database import"
      onClick={handleBackdropClick}
    >
      <div className="import-confirm-modal__panel surface-glass-blur" ref={panelRef}>
        <h2 className="import-confirm-modal__title">Import the database?</h2>
        <p className="import-confirm-modal__hint">
          A file picker will now open to select the dump file(s) to import (for a multi-part bundle, select
          the manifest and all parts together). Before merging, the app will save a backup of the current database to
          the <strong>backups</strong> folder next to the app — no further questions asked. Conflicting materials
          are resolved in favor of the later change.
        </p>
        <label className="import-confirm-modal__field">
          <span>
            To confirm, type <strong>{CONFIRM_WORD}</strong> in capital letters
          </span>
          <input
            type="text"
            className="import-confirm-modal__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
            autoFocus
            placeholder={CONFIRM_WORD}
          />
        </label>
        <div className="import-confirm-modal__actions">
          <button
            type="button"
            className="import-confirm-modal__button import-confirm-modal__button--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="import-confirm-modal__button import-confirm-modal__button--danger"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
