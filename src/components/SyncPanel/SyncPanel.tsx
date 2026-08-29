import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  backupSystemDb,
  getBackupState,
  login,
  exportDatabase,
  exportSeedForInstaller,
  importDatabase,
  restoreSystemDb,
} from "../../data/repository";
import type { ExportFilesResult, ImportProgress, ImportReport } from "../../data/sync";
import type { WrittenDump } from "../../data/dumpStream";
import type { SystemRestoreReport } from "../../data/systemBackup";
import type { SeedExportResult } from "../../data/seedExport";
import { pulseExchanging } from "../../data/syncStatusBus";
import ImportConfirmModal from "./ImportConfirmModal";
import PasswordField from "../PasswordField/PasswordField";
import { useCurrentUser } from "../../context/CurrentUserContext";
import ServerSyncSection from "./ServerSyncSection";
import "./SyncPanel.css";
import { humanError, WORDS, pluralize } from "../../utils/humanText";
import { checkReminder, formatBackupMoment, reminderText } from "../../data/backupReminder";
import type { BackupState } from "../../data/backupReminder";

type OperationPhase = "idle" | "export" | "import" | "seed-export" | "system-backup" | "system-restore";

export default function SyncPanel() {
  const [phase, setPhase] = useState<OperationPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<ExportFilesResult | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [seedExportResult, setSeedExportResult] = useState<SeedExportResult | null>(null);
  const [systemBackupResult, setSystemBackupResult] = useState<WrittenDump | null>(null);
  const [systemRestoreResult, setSystemRestoreResult] = useState<SystemRestoreReport | null>(null);

  async function handleExport() {
    setPhase("export");
    setError(null);
    setExportResult(null);
    pulseExchanging(true);
    try {
      const result = await exportDatabase();
      setExportResult(result); // null = the user cancelled choosing a save location
    } catch (err) {
      setError(humanError(err));
    } finally {
      setPhase("idle");
      pulseExchanging(false);
    }
  }

  async function handleImport() {
    setConfirmingImport(false);
    setPhase("import");
    setError(null);
    setImportReport(null);
    setImportProgress(null);
    pulseExchanging(true);
    try {
      const report = await importDatabase(setImportProgress);
      setImportReport(report); // null = the user cancelled choosing the file(s)/backup
    } catch (err) {
      setError(humanError(err));
    } finally {
      setPhase("idle");
      setImportProgress(null);
      pulseExchanging(false);
    }
  }

  async function handleUnlockSeed(event: FormEvent) {
    event.preventDefault();
    if (!currentUser || !seedPassword) return;
    setSeedUnlockError(null);
    const result = await login(currentUser.login, seedPassword);
    if (!result) {
      setSeedUnlockError("Incorrect password.");
      return;
    }
    setSeedPassword("");
    setSeedUnlocked(true);
  }

  async function handleSeedExport() {
    setPhase("seed-export");
    setError(null);
    setSeedExportResult(null);
    pulseExchanging(true);
    try {
      const result = await exportSeedForInstaller();
      setSeedExportResult(result);
    } catch (err) {
      setError(humanError(err));
    } finally {
      setPhase("idle");
      pulseExchanging(false);
    }
  }

  async function handleSystemBackup() {
    setPhase("system-backup");
    setError(null);
    setSystemBackupResult(null);
    pulseExchanging(true);
    try {
      setSystemBackupResult(await backupSystemDb());
    } catch (err) {
      setError(humanError(err));
    } finally {
      setPhase("idle");
      pulseExchanging(false);
    }
  }

  async function handleSystemRestore() {
    setPhase("system-restore");
    setError(null);
    setSystemRestoreResult(null);
    pulseExchanging(true);
    try {
      setSystemRestoreResult(await restoreSystemDb()); // null = the user cancelled the selection
    } catch (err) {
      setError(humanError(err));
    } finally {
      setPhase("idle");
      pulseExchanging(false);
    }
  }

  const [serverBusy, setServerBusy] = useState(false);
  const [seedUnlocked, setSeedUnlocked] = useState(false);
  const [seedPassword, setSeedPassword] = useState("");
  const [seedUnlockError, setSeedUnlockError] = useState<string | null>(null);
  const { currentUser } = useCurrentUser();
  const [backupState, setBackupState] = useState<BackupState | null>(null);
  useEffect(() => {
    if (phase === "idle") getBackupState().then(setBackupState).catch(() => undefined);
  }, [phase]);

  const reminder = backupState ? reminderText(checkReminder(backupState)) : null;
  const busy = phase !== "idle" || serverBusy;

  return (
    <div className="sync-panel">
      {reminder && (
        <p className="sync-panel__reminder" role="status">
          {reminder}
        </p>
      )}
      {backupState && (
        <p className="sync-panel__last-backup">
          Last backup of materials — {formatBackupMoment(backupState.lastContentBackupAt)}; of
          accounts — {formatBackupMoment(backupState.lastSystemBackupAt)}.
        </p>
      )}

      <ServerSyncSection busy={busy} onBusyChange={setServerBusy} />

      <section className="sync-panel__section">
        <h3 className="sync-panel__section-title">Save the database to a file</h3>
        <p className="sync-panel__section-hint">
          Saves all sections and materials (with all attachments). The location is chosen once:
          if the database does not fit into a single file, several numbered parts and a manifest
          are written next to the chosen file — on import, select them all together.
        </p>
        <button type="button" className="sync-panel__button" onClick={handleExport} disabled={busy}>
          {phase === "export" ? "Saving…" : "Save database to file"}
        </button>
        {exportResult && (
          <div className="sync-panel__report">
            <p>
              Done: saved {pluralize(exportResult.docCount, WORDS.document)}, {formatBytes(exportResult.byteSize)}
              {exportResult.partCount > 1 ? `, ${pluralize(exportResult.fileNames.length, WORDS.file)}` : ""}.
            </p>
            {exportResult.partCount > 1 && (
              <ul className="sync-panel__resolutions">
                {exportResult.fileNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="sync-panel__section">
        <h3 className="sync-panel__section-title">Load the database from a file</h3>
        <p className="sync-panel__section-hint">
          Merges the contents of a dump file (or a multi-part bundle — when picking,
          select the manifest and all part files together) into this computer's database. Conflicting
          materials are resolved in favor of the later change. Before merging, an
          automatic backup of the current state is made.
        </p>
        <button
          type="button"
          className="sync-panel__button sync-panel__button--secondary"
          onClick={() => setConfirmingImport(true)}
          disabled={busy}
        >
          {phase === "import" ? "Importing…" : "Load database from file"}
        </button>
        {importProgress && (
          <div className="sync-panel__progress">
            <div className="sync-panel__progress-track">
              <div
                className="sync-panel__progress-fill"
                style={{ width: `${progressPercent(importProgress)}%` }}
              />
            </div>
            <p className="sync-panel__progress-label">{formatProgressLabel(importProgress)}</p>
          </div>
        )}
        {importReport && (
          <div className="sync-panel__report">
            <p>
              Merged {pluralize(importReport.merged, WORDS.document)}: created {importReport.created}, updated{" "}
              {importReport.updated}. Conflicts resolved: {importReport.conflictsResolved}.
            </p>
            {importReport.failures.length > 0 && (
              <>
                <p className="sync-panel__error">
                  The database rejected {pluralize(importReport.failures.length, WORDS.document)} — the import is incomplete:
                </p>
                <ul className="sync-panel__resolutions">
                  {importReport.failures.map((f) => (
                    <li key={f.docId}>
                      {f.docId} — {f.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {importReport.resolutions.length > 0 && (
              <ul className="sync-panel__resolutions">
                {importReport.resolutions.map((r) => (
                  <li key={r.docId}>
                    {r.docId} — winner:{" "}
                    {r.wonBy === "imported" ? "the imported version" : "this computer's version"} (revisions
                    discarded: {r.discarded})
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="sync-panel__section">
        <h3 className="sync-panel__section-title">Accounts and log</h3>
        <p className="sync-panel__section-hint">
          A separate backup of the system database: users and their passwords, the edit log, the shelf,
          diagnostics. This data is included neither in the materials export nor in the installer —
          there is nowhere to restore it from except this backup. The file goes into the{" "}
          <code>backups/</code> folder next to the app, with no location dialog.
        </p>
        <div className="sync-panel__button-row">
          <button
            type="button"
            className="sync-panel__button sync-panel__button--secondary"
            onClick={handleSystemBackup}
            disabled={busy}
          >
            {phase === "system-backup" ? "Saving…" : "Save a backup of accounts"}
          </button>
          <button
            type="button"
            className="sync-panel__button sync-panel__button--secondary"
            onClick={handleSystemRestore}
            disabled={busy}
          >
            {phase === "system-restore" ? "Restoring…" : "Restore from a backup"}
          </button>
        </div>
        {systemBackupResult && (
          <p className="sync-panel__report">
            Done: saved {pluralize(systemBackupResult.docCount, WORDS.document)} —{" "}
            <code>backups/{systemBackupResult.fileNames[0]}</code>
            {systemBackupResult.partCount > 1 ? ` and ${pluralize(systemBackupResult.fileNames.length - 1, WORDS.file)} more next to it` : ""}.
          </p>
        )}
        {systemRestoreResult && (
          <p className="sync-panel__report">
            Restored {pluralize(systemRestoreResult.merged, WORDS.document)}: new {systemRestoreResult.created}, updated{" "}
            {systemRestoreResult.updated}. Conflicts resolved: {systemRestoreResult.conflictsResolved}.
          </p>
        )}
      </section>

      <section className="sync-panel__section">
        <h3 className="sync-panel__section-title">Export seed for the installer</h3>
        <p className="sync-panel__section-hint">
          For the release build: saves the contents of this database (with all attachments, in
          several parts if needed) into the <code>backups/</code> folder next to this build's
          executable, with no location dialog. Then <code>scripts/export_seed.py</code>
          packs the result into an installer resource.
        </p>
        {seedUnlocked ? (
          <button
            type="button"
            className="sync-panel__button sync-panel__button--secondary"
            onClick={handleSeedExport}
            disabled={busy}
          >
            {phase === "seed-export" ? "Exporting…" : "Export seed"}
          </button>
        ) : (
          <form className="sync-panel__unlock" onSubmit={handleUnlockSeed}>
            <PasswordField
              className="sync-panel__input"
              placeholder="Password to confirm"
              value={seedPassword}
              onChange={(e) => setSeedPassword(e.target.value)}
              error={seedUnlockError}
            />
            <button
              type="submit"
              className="sync-panel__button sync-panel__button--secondary"
              disabled={busy || !seedPassword}
            >
              Confirm password
            </button>
          </form>
        )}
        {seedExportResult && (
          <p className="sync-panel__report">
            Done: {pluralize(seedExportResult.docCount, WORDS.document)}, {pluralize(seedExportResult.parts, WORDS.part)} —
            see <code>backups/{seedExportResult.baseName}</code> (and next to it, if there is more than one part).
          </p>
        )}
      </section>

      {error && <p className="sync-panel__error">Error: {error}</p>}

      {confirmingImport && (
        <ImportConfirmModal onConfirm={handleImport} onCancel={() => setConfirmingImport(false)} />
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function progressPercent(progress: ImportProgress): number {
  if (progress.totalFiles === 0) return 0;
  return Math.round((progress.fileIndex / progress.totalFiles) * 100);
}

function formatProgressLabel(progress: ImportProgress): string {
  const action = progress.phase === "reading" ? "Reading" : "Merging";
  const fileCounter = `file ${progress.fileIndex} of ${progress.totalFiles}`;
  const percent = `${progressPercent(progress)}%`;
  if (progress.phase === "merging" && progress.totalDocsHint !== null) {
    return `${action}: ${fileCounter} (${percent}) — ${progress.docsMergedSoFar} of ${progress.totalDocsHint} documents merged`;
  }
  return `${action}: ${fileCounter} (${percent})`;
}
