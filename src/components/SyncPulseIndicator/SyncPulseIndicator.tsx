import { useEffect, useState } from "react";
import { getSyncStatus, onSyncStatusChange } from "../../data/syncStatusBus";
import "./SyncPulseIndicator.css";

const STATUS_LABELS: Record<string, string> = {
  idle: "All saved",
  writing: "Saving…",
  exchanging: "Database transfer in progress…",
  error: "Unable to track changes",
};

export default function SyncPulseIndicator() {
  const [state, setState] = useState(getSyncStatus);

  useEffect(() => onSyncStatusChange(setState), []);

  const label = state.status === "error" && state.errorMessage ? state.errorMessage : STATUS_LABELS[state.status];

  return (
    <div className="sync-pulse" title={label} data-help="sync-indicator">
      <span className="sync-pulse__dot" data-status={state.status} aria-hidden="true" />
      <span className="sync-pulse__label">{STATUS_LABELS[state.status]}</span>
    </div>
  );
}
