import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  changePassword,
  createSection,
  createUser,
  exportDiagnosticsLog,
  getAppLog,
  getChangeLog,
  getSections,
  getUserDisplayNames,
  listUsers,
  setSectionHidden,
} from "../data/repository";
import type { AppLog, Change, MacroCategory, Section, User } from "../data/types";
import { MACRO_CATEGORIES } from "../data/types";
import { slugify } from "../data/slug";
import SyncPanel from "../components/SyncPanel/SyncPanel";
import AppearanceSettings from "../components/AppearanceSettings/AppearanceSettings";
import ChangeTimeline from "../components/ChangeTimeline/ChangeTimeline";
import { useLiteMode } from "../context/LiteModeContext";
import "./AdminPage.css";
import { humanError } from "../utils/humanText";

const RECENT_CHANGES_LIMIT = 10;

function ChangeLogSection() {
  const [entries, setEntries] = useState<Change[]>([]);
  const [appLog, setAppLog] = useState<AppLog[]>([]);
  const [userDisplayNames, setUserDisplayNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getChangeLog(), getAppLog()])
      .then(([changes, log]) => {
        setEntries(changes);
        setAppLog(log);
      })
      .finally(() => setLoading(false));
    getUserDisplayNames().then(setUserDisplayNames);
  }, []);

  const recent = entries.slice(0, RECENT_CHANGES_LIMIT);

  return (
    <section className="admin-page__section" data-help="admin-journal-link">
      <h2 className="admin-page__section-title">Change log</h2>
      <p className="admin-page__section-hint">
        The latest {RECENT_CHANGES_LIMIT} entries. Read-only — entries cannot be edited or deleted from the
        interface.
      </p>

      {loading ? (
        <p className="admin-page__hint">Loading…</p>
      ) : (
        <ChangeTimeline entries={recent} appLog={appLog} userDisplayNames={userDisplayNames} />
      )}

      <Link to="/admin/journal" className="admin-page__button admin-page__button--secondary admin-page__show-all">
        Show all
      </Link>
    </section>
  );
}

function UsersSection() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [newLogin, setNewLogin] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  function reload() {
    setLoading(true);
    return listUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChangePassword(login: string) {
    const next = passwordDrafts[login]?.trim();
    if (!next) return;
    setError(null);
    setNotice(null);
    try {
      await changePassword(login, next);
      setPasswordDrafts((prev) => ({ ...prev, [login]: "" }));
      setNotice(`Password for ${login} updated.`);
      await reload();
    } catch (err) {
      setError(humanError(err));
    }
  }

  async function handleCreateUser(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await createUser(newLogin.trim(), newDisplayName.trim() || newLogin.trim(), newPassword);
      setNewLogin("");
      setNewDisplayName("");
      setNewPassword("");
      setNotice(`User ${newLogin} created.`);
      await reload();
    } catch (err) {
      setError(humanError(err));
    }
  }

  return (
    <section className="admin-page__section" data-help="admin-users">
      <h2 className="admin-page__section-title">Users</h2>
      <p className="admin-page__section-hint">
        Add staff accounts and change their passwords here. Deleting an account is not supported yet —
        if someone no longer works here, change their password.
      </p>

      {loading ? (
        <p className="admin-page__hint">Loading…</p>
      ) : (
        <table className="admin-page__table">
          <thead>
            <tr>
              <th>Login</th>
              <th>Name</th>
              <th>Last sign-in</th>
              <th>New password</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id}>
                <td>{user.login}</td>
                <td>{user.displayName}</td>
                <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("en-US") : "—"}</td>
                <td>
                  <input
                    type="password"
                    className="admin-page__input"
                    value={passwordDrafts[user.login] ?? ""}
                    onChange={(e) =>
                      setPasswordDrafts((prev) => ({ ...prev, [user.login]: e.target.value }))
                    }
                    placeholder="New password"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="admin-page__button admin-page__button--secondary"
                    onClick={() => handleChangePassword(user.login)}
                    disabled={!passwordDrafts[user.login]?.trim()}
                  >
                    Change
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="admin-page__create-user" onSubmit={handleCreateUser}>
        <h3 className="admin-page__create-user-title">Create user</h3>
        <input
          type="text"
          className="admin-page__input"
          placeholder="Login"
          value={newLogin}
          onChange={(e) => setNewLogin(e.target.value)}
          required
        />
        <input
          type="text"
          className="admin-page__input"
          placeholder="Display name (optional)"
          value={newDisplayName}
          onChange={(e) => setNewDisplayName(e.target.value)}
        />
        <input
          type="password"
          className="admin-page__input"
          placeholder="Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <button type="submit" className="admin-page__button" disabled={!newLogin.trim() || !newPassword}>
          Create
        </button>
      </form>

      {notice && <p className="admin-page__notice">{notice}</p>}
      {error && <p className="admin-page__error">Error: {error}</p>}
    </section>
  );
}

function DiagnosticsSection() {
  const { liteMode } = useLiteMode();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "cancelled" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setStatus("saving");
    setError(null);
    try {
      const saved = await exportDiagnosticsLog({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
        deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? null,
        liteMode,
      });
      setStatus(saved ? "saved" : "cancelled");
    } catch (err) {
      setStatus("error");
      setError(humanError(err));
    }
  }

  return (
    <section className="admin-page__section" data-help="admin-diagnostics">
      <h2 className="admin-page__section-title">Diagnostics</h2>
      <p className="admin-page__section-hint">
        A technical file for troubleshooting: recent application log entries, versions, and
        environment details. Material contents and personal data are not included.
      </p>
      <button type="button" className="admin-page__button" onClick={handleExport} disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Export diagnostics log"}
      </button>
      {status === "saved" && <p className="admin-page__notice">Diagnostics file saved.</p>}
      {status === "error" && <p className="admin-page__error">Save error: {error}</p>}
    </section>
  );
}

function SectionsSection() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busySectionId, setBusySectionId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [macroCategory, setMacroCategory] = useState<MacroCategory>("methods");
  const [order, setOrder] = useState(1);
  const [creating, setCreating] = useState(false);

  function reload() {
    setLoading(true);
    return getSections()
      .then(setSections)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slugPreview = useMemo(() => slugify(title), [title]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      await createSection({ title: trimmedTitle, description: description.trim(), macroCategory, order });
      setNotice(`Section "${trimmedTitle}" created, address: ${slugPreview}.`);
      setTitle("");
      setDescription("");
      setOrder(1);
      await reload();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleHidden(section: Section) {
    setBusySectionId(section._id);
    setError(null);
    try {
      await setSectionHidden(section._id, !section.hidden);
      await reload();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusySectionId(null);
    }
  }

  return (
    <section className="admin-page__section" data-help="admin-sections">
      <h2 className="admin-page__section-title">Sections</h2>
      <p className="admin-page__section-hint">
        Renaming and deleting sections is not supported — neither for the original fifteen nor for ones created
        here. A section created by mistake can be hidden from navigation: the document and its materials (if any)
        are not deleted, and hiding is reversible.
      </p>

      {loading ? (
        <p className="admin-page__hint">Loading…</p>
      ) : (
        <table className="admin-page__table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Macro category</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <tr key={section._id}>
                <td>{section.title}</td>
                <td>{MACRO_CATEGORIES[section.macroCategory]}</td>
                <td>{section.hidden ? "Hidden from navigation" : "Visible"}</td>
                <td>
                  <button
                    type="button"
                    className="admin-page__button admin-page__button--secondary"
                    onClick={() => handleToggleHidden(section)}
                    disabled={busySectionId === section._id}
                  >
                    {section.hidden ? "Show" : "Hide"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="admin-page__create-form" onSubmit={handleCreate}>
        <h3 className="admin-page__create-form-title">Create section</h3>
        <input
          type="text"
          className="admin-page__input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <input
          type="text"
          className="admin-page__input"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <select
          className="admin-page__input"
          value={macroCategory}
          onChange={(e) => setMacroCategory(e.target.value as MacroCategory)}
        >
          {Object.entries(MACRO_CATEGORIES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="admin-page__input"
          placeholder="Position"
          value={order}
          min={1}
          onChange={(e) => setOrder(Number(e.target.value) || 1)}
        />
        {title.trim() && (
          <p className="admin-page__slug-preview">
            Section address: <strong>{slugPreview}</strong> — it becomes a permanent part of this section's
            material identifiers and cannot be changed after creation.
          </p>
        )}
        <button type="submit" className="admin-page__button" disabled={creating || !title.trim()}>
          {creating ? "Creating…" : "Create section"}
        </button>
      </form>

      {notice && <p className="admin-page__notice">{notice}</p>}
      {error && <p className="admin-page__error">Error: {error}</p>}
    </section>
  );
}

export default function AdminPage() {
  return (
    <div className="admin-page">
      <p className="admin-page__eyebrow">Admin</p>
      <h1 className="admin-page__title">Aurora administration</h1>

      <ChangeLogSection />

      <section className="admin-page__section" data-help="admin-backup">
        <h2 className="admin-page__section-title">Sync</h2>
        <SyncPanel />
      </section>

      <UsersSection />

      <SectionsSection />

      <section className="admin-page__section">
        <h2 className="admin-page__section-title">Appearance</h2>
        <AppearanceSettings />
      </section>

      <DiagnosticsSection />
    </div>
  );
}
