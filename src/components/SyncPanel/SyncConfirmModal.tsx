import { useEffect, useMemo, useRef } from "react";
import { useFocusTrap } from "../../utils/useFocusTrap";
import { isMaterialType } from "../../data/replication";
import type { SyncChangeKind, SyncPreview, SyncPreviewItem } from "../../data/replication";
import "./SyncConfirmModal.css";

/**
 * Sync confirmation, showing exactly what would change.
 *
 * Why. A sync overwrites materials on this machine with the server's version,
 * and replication says nothing about divergences — it silently picks a winner
 * by revision. A person pressed the button blind and learned the consequences
 * afterwards. Now, before the sync, it is visible line by line: what arrives,
 * what leaves, and — most importantly — what was edited on both sides.
 *
 * The window does not appear when there is nothing to change: confirming an
 * empty sync is an extra click, not caution.
 */

const KIND_TITLES: Record<SyncChangeKind, string> = {
  "incoming-updated": "Will be updated on this computer",
  "incoming-new": "Will appear on this computer",
  diverging: "Edited both here and on the server",
  "outgoing-updated": "Will go to the server (your version is newer)",
  "outgoing-new": "Will go to the server for the first time",
};

const KIND_ORDER: SyncChangeKind[] = [
  "incoming-updated",
  "incoming-new",
  "diverging",
  "outgoing-updated",
  "outgoing-new",
];

export default function SyncConfirmModal({
  preview,
  onConfirm,
  onCancel,
}: {
  preview: SyncPreview;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);

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

  // Materials separately from housekeeping: what worries a person is whether
  // their articles will be swapped out, not that a settings document arrives.
  const groups = useMemo(() => {
    const all: SyncPreviewItem[] = preview.databases.flatMap((d) => d.items);
    return KIND_ORDER.map((kind) => {
      const items = all.filter((i) => i.kind === kind);
      return {
        kind,
        total: preview.counts[kind],
        materials: items.filter((i) => isMaterialType(i.docType)),
        service: items.filter((i) => !isMaterialType(i.docType)),
      };
    }).filter((g) => g.total > 0);
  }, [preview]);

  const incoming = preview.counts["incoming-new"] + preview.counts["incoming-updated"];
  const outgoing = preview.counts["outgoing-new"] + preview.counts["outgoing-updated"];
  const diverging = preview.counts.diverging;

  return (
    <div
      className="sync-confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm the sync with the server"
      onClick={handleBackdropClick}
    >
      <div className="sync-confirm-modal__panel surface-glass-blur" ref={panelRef}>
        <h2 className="sync-confirm-modal__title">Sync with the server?</h2>

        <p className="sync-confirm-modal__summary">
          Arriving here: <strong>{incoming}</strong>. Going to the server: <strong>{outgoing}</strong>.
          {diverging > 0 && (
            <>
              {" "}
              Divergences: <strong className="sync-confirm-modal__danger">{diverging}</strong>.
            </>
          )}
        </p>

        {diverging > 0 && (
          <p className="sync-confirm-modal__warning">
            {diverging} {diverging === 1 ? "document was" : "documents were"} edited both here and on
            the server. A sync does not merge such edits: it will keep one version, and not
            necessarily yours. If something important is among them — save the database to a file
            first (the button above), then sync.
          </p>
        )}

        {preview.hasErrors && (
          <p className="sync-confirm-modal__warning">
            One of the databases could not be reached — only what is visible is shown. The sync will
            most likely not go through completely.
          </p>
        )}

        <div className="sync-confirm-modal__list">
          {groups.map((group) => (
            <section key={group.kind} className="sync-confirm-modal__group">
              <h3 className="sync-confirm-modal__group-title">
                {KIND_TITLES[group.kind]} — {group.total}
              </h3>
              <ul className="sync-confirm-modal__items">
                {group.materials.map((item) => (
                  <li key={item.id} className="sync-confirm-modal__item">
                    {item.title}
                  </li>
                ))}
                {group.service.length > 0 && (
                  <li className="sync-confirm-modal__item sync-confirm-modal__item--service">
                    Housekeeping: {group.service.map((i) => i.title).join(", ")}
                  </li>
                )}
              </ul>
            </section>
          ))}
        </div>

        {preview.truncated && (
          <p className="sync-confirm-modal__hint">
            The first rows of each group are shown — there are more changes than the window holds.
          </p>
        )}

        <p className="sync-confirm-modal__hint">
          Materials the sync does not touch stay as they are. A sync cannot be undone once started,
          but a backup of the database is always one press away — “Save the database to a file”.
        </p>

        <div className="sync-confirm-modal__actions">
          <button
            type="button"
            className="sync-confirm-modal__button sync-confirm-modal__button--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={
              "sync-confirm-modal__button " +
              (diverging > 0 ? "sync-confirm-modal__button--danger" : "sync-confirm-modal__button--primary")
            }
            onClick={onConfirm}
            autoFocus
          >
            {diverging > 0 ? "Sync anyway" : "Sync"}
          </button>
        </div>
      </div>
    </div>
  );
}
