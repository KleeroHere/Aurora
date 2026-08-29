import { useEffect, useRef, useState } from "react";
import type { Material, Section } from "../../data/types";
import { useFocusTrap } from "../../utils/useFocusTrap";
import "./DeleteMaterialModal.css";

const CONFIRM_WORD = "DELETE";

export default function DeleteMaterialModal({
  material,
  section,
  onConfirm,
  onCancel,
}: {
  material: Material;
  section: Section | undefined;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

  const attachmentCount = Object.keys(material._attachments ?? {}).length;
  const canDelete = input === CONFIRM_WORD;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  async function handleConfirm() {
    if (!canDelete || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onCancel();
  }

  return (
    <div
      className="delete-material-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Delete material"
      onClick={handleBackdropClick}
    >
      <div className="delete-material-modal__panel surface-glass-blur" ref={panelRef}>
        <h2 className="delete-material-modal__title">Delete this material?</h2>
        <dl className="delete-material-modal__summary">
          <div>
            <dt>Material</dt>
            <dd>{material.title}</dd>
          </div>
          <div>
            <dt>Section</dt>
            <dd>{section?.title ?? material.sectionId}</dd>
          </div>
          <div>
            <dt>Attachments</dt>
            <dd>{attachmentCount}</dd>
          </div>
        </dl>
        <p className="delete-material-modal__hint">
          The material disappears from the interface immediately. You can undo the deletion within 10 seconds via
          the notification at the bottom of the screen — after that, it can only be restored from a backup.
        </p>
        <label className="delete-material-modal__field">
          <span>
            To confirm, type <strong>{CONFIRM_WORD}</strong> in capital letters
          </span>
          <input
            type="text"
            className="delete-material-modal__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
            autoFocus
            placeholder={CONFIRM_WORD}
          />
        </label>
        <div className="delete-material-modal__actions">
          <button
            type="button"
            className="delete-material-modal__button delete-material-modal__button--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="delete-material-modal__button delete-material-modal__button--danger"
            onClick={handleConfirm}
            disabled={!canDelete || busy}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
