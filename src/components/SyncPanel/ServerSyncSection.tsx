import { useEffect, useState } from "react";
import { getReplicationSettings, replicateWithServer, setReplicationSettings } from "../../data/repository";
import type { ReplicationSettings, ReplicationServer, SyncOutcome } from "../../data/replication";
import { probeServer } from "../../data/replication";
import { pulseExchanging } from "../../data/syncStatusBus";
import { humanError } from "../../utils/humanText";

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

  async function handleSync() {
    setRunning(true);
    onBusyChange(true);
    setError(null);
    setOutcomes(null);
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
          onClick={handleSync}
          disabled={running || busy || !addressReady}
          title={addressReady ? undefined : "Enter the server address and save it first"}
        >
          {running ? "Syncing…" : "Sync with server"}
        </button>
      </div>

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
