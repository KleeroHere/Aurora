import { useEffect, useState } from "react";
import {
  getReplicationSettings,
  previewServerSync,
  replicateWithServer,
  setReplicationSettings,
} from "../../data/repository";
import type { ReplicationSettings, ReplicationServer, SyncOutcome, SyncPreview } from "../../data/replication";
import { probeServer } from "../../data/replication";
import { pulseExchanging } from "../../data/syncStatusBus";
import { humanError } from "../../utils/humanText";
import SyncConfirmModal from "./SyncConfirmModal";

const DATABASE_LABELS: Record<string, string> = {
  system: "Accounts and log",
  content: "Materials",
};

function describeDatabase(name: string): string {
  return DATABASE_LABELS[name] ?? name;
}

function formatMoment(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
}

export default function ServerSyncSection({ busy, onBusyChange }: { busy: boolean; onBusyChange: (b: boolean) => void }) {
  const [settings, setSettings] = useState<ReplicationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  // Sync preview: computed before the sync and shown in the confirmation
  // window. `preparing` is separate from `running` because this is not the sync
  // yet and there is nothing to interrupt.
  const [preparing, setPreparing] = useState(false);
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [outcomes, setOutcomes] = useState<SyncOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    getReplicationSettings().then(setSettings).catch((err) => setError(humanError(err)));
  }, []);

  if (!settings) {
    return (
      <section className="sync-panel__section">
        <h3 className="sync-panel__section-title">Sync server</h3>
        <p className="sync-panel__section-hint">Loading settings…</p>
      </section>
    );
  }

  function patchServer(id: ReplicationServer["id"], patch: Partial<ReplicationServer>) {
    setSettings((current) =>
      current ? { ...current, servers: current.servers.map((s) => (s.id === id ? { ...s, ...patch } : s)) } : current,
    );
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await setReplicationSettings({
        servers: settings.servers,
        activeServerId: settings.activeServerId,
      });
      setSettings(saved);
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  }

  /**
   * Pressing "Sync" no longer starts the sync straight away: first it works out
   * what exactly would change, and the person confirms it.
   *
   * The window appears only when there is something to change. Confirming an
   * empty sync is pointless — an extra click, not caution — so with a zero
   * preview the run starts immediately and honestly reports zeroes.
   *
   * If one of the databases could not be reached, the window is shown anyway —
   * with a warning and whatever is visible from the other one. That beats a
   * bare error: there are two databases, and one being unreachable does not
   * mean the sync is pointless. The person decides, not the script.
   */
  async function handleSyncClick() {
    setPreparing(true);
    onBusyChange(true);
    setError(null);
    setOutcomes(null);
    try {
      const next = await previewServerSync();
      if (next.total === 0 && !next.hasErrors) {
        await runSync();
        return;
      }
      setPreview(next);
    } catch (err) {
      setError(humanError(err));
    } finally {
      setPreparing(false);
      onBusyChange(false);
    }
  }

  async function runSync() {
    setPreview(null);
    setRunning(true);
    onBusyChange(true);
    setError(null);
    pulseExchanging(true);
    try {
      const result = await replicateWithServer();
      setOutcomes(result);
      setSettings(await getReplicationSettings());
    } catch (err) {
      setError(humanError(err));
    } finally {
      setRunning(false);
      onBusyChange(false);
      pulseExchanging(false);
    }
  }

  const active = settings.servers.find((s) => s.id === settings.activeServerId);
  const addressReady = Boolean(active?.url.trim());

  return (
    <section className="sync-panel__section">
      <h3 className="sync-panel__section-title">Sync server</h3>
      <p className="sync-panel__section-hint">
        Sync runs on the button press, in a single pass — the app keeps no permanent connection and
        works fully even if there is no server at all. Accounts are exchanged first,
        then materials. The file-based sync above still remains: it is a fallback channel and works
        always.
      </p>

      {settings.servers.map((server) => (
        <div key={server.id} className="sync-panel__server">
          <label className="sync-panel__server-choice">
            <input
              type="radio"
              name="aurora-active-server"
              checked={settings.activeServerId === server.id}
              onChange={() => setSettings({ ...settings, activeServerId: server.id })}
            />
            <span>{server.label}</span>
          </label>
          <input
            type="text"
            className="sync-panel__input"
            placeholder="https://your-couchdb.example.com:5984"
            value={server.url}
            onChange={(e) => patchServer(server.id, { url: e.target.value })}
            aria-label={`Address: ${server.label}`}
          />
          <div className="sync-panel__server-credentials">
            <input
              type="text"
              className="sync-panel__input"
              placeholder="Username for the server"
              value={server.username}
              onChange={(e) => patchServer(server.id, { username: e.target.value })}
              aria-label={`Server account username: ${server.label}`}
            />
            <input
              type="password"
              className="sync-panel__input"
              placeholder="Password for the server"
              value={server.password}
              onChange={(e) => patchServer(server.id, { password: e.target.value })}
              aria-label={`Server account password: ${server.label}`}
            />
          </div>
        </div>
      ))}

      <p className="sync-panel__section-hint">
        The username and password here are a separate technical server account, not the app
        sign-in.
      </p>

      <div className="sync-panel__button-row">
        <button
          type="button"
          className="sync-panel__button sync-panel__button--secondary"
          onClick={handleSave}
          disabled={saving || running || busy}
        >
          {saving ? "Saving…" : "Save address"}
        </button>
        <button
          type="button"
          className="sync-panel__button sync-panel__button--secondary"
          onClick={async () => {
            const server = settings.servers.find((s) => s.id === settings.activeServerId);
            if (!server) return;
            setProbing(true);
            setProbeResult(null);
            try {
              setProbeResult(await probeServer(server));
            } finally {
              setProbing(false);
            }
          }}
          disabled={probing || running || busy || !addressReady}
          title="One quick request to the server — no sync is started"
        >
          {probing ? "Checking…" : "Test connection"}
        </button>
        <button
          type="button"
          className="sync-panel__button"
          onClick={handleSyncClick}
          disabled={preparing || running || busy || !addressReady}
          title={addressReady ? undefined : "Enter the server address and save it first"}
        >
          {preparing ? "Working out the changes…" : running ? "Syncing…" : "Sync with server"}
        </button>
      </div>

      {preview && <SyncConfirmModal preview={preview} onConfirm={runSync} onCancel={() => setPreview(null)} />}

      {probeResult && (
        <p className="sync-panel__section-hint" role="status">
          {probeResult.ok ? "✓ " : ""}
          {probeResult.message}
        </p>
      )}

      {outcomes && (
        <div className="sync-panel__report">
          {outcomes.map((outcome) => (
            <p key={outcome.database}>
              <strong>{describeDatabase(outcome.database)}:</strong>{" "}
              {outcome.ok
                ? `received ${outcome.docsRead}, sent ${outcome.docsWritten}${
                    outcome.conflicts > 0 ? `, conflicts — ${outcome.conflicts}` : ""
                  }.`
                : outcome.message}
            </p>
          ))}
        </div>
      )}

      {settings.lastSync.length > 0 && (
        <div className="sync-panel__report">
          <p className="sync-panel__section-hint">Last sync:</p>
          {settings.lastSync.map((record) => (
            <p key={`${record.database}-${record.at}`}>
              {describeDatabase(record.database)} — {formatMoment(record.at)}:{" "}
              {record.ok
                ? `received ${record.docsRead}, sent ${record.docsWritten}${
                    record.conflicts > 0 ? `, conflicts — ${record.conflicts}` : ""
                  }`
                : "failed"}
            </p>
          ))}
        </div>
      )}

      {error && <p className="sync-panel__error">{error}</p>}
    </section>
  );
}
