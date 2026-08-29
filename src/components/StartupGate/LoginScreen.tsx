import { publicUrl } from "../../utils/publicUrl";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { APP_VERSION, changePassword, listUsers, login as loginRequest } from "../../data/repository";
import type { User } from "../../data/types";
import { useCurrentUser } from "../../context/CurrentUserContext";
import PasswordField from "../PasswordField/PasswordField";
import { PASSWORD_RULES_HINT, checkPassword } from "../../data/passwordRules";
import "./LoginScreen.css";

const INTRO_LAST_FRAME_URL = publicUrl("brand/intro-last-frame.jpg");

const LAST_LOGIN_KEY = "aurora.lastLogin";

function readLastLogin(): string | null {
  try {
    return localStorage.getItem(LAST_LOGIN_KEY);
  } catch {
    return null;
  }
}

function rememberLastLogin(login: string): void {
  try {
    localStorage.setItem(LAST_LOGIN_KEY, login);
  } catch {
  }
}

export default function LoginScreen({ onContinue }: { onContinue: () => void }) {
  const { setCurrentUser } = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedLogin, setSelectedLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);

  const [defaultPasswordNudge, setDefaultPasswordNudge] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordAgain, setNewPasswordAgain] = useState("");
  const [nudgeBusy, setNudgeBusy] = useState(false);
  const [nudgeDone, setNudgeDone] = useState(false);

  useEffect(() => {
    listUsers().then((list) => {
      setUsers(list);
      setUsersLoaded(true);
      if (list.length === 0) return;
      const last = readLastLogin();
      const remembered = last && list.some((u) => u.login === last) ? last : list[0].login;
      setSelectedLogin(remembered);
    });
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedLogin || !password) return;
    setBusy(true);
    setError(null);
    try {
      const result = await loginRequest(selectedLogin, password);
      if (!result) {
        setError("Incorrect login or password.");
        return;
      }
      rememberLastLogin(result.user.login);
      setCurrentUser(result.user);
      if (result.usedDefaultPassword) {
        setDefaultPasswordNudge(result.user);
      } else {
        onContinue();
      }
    } finally {
      setBusy(false);
    }
  }

  const nudgeCheck = checkPassword(newPassword, newPasswordAgain.length > 0 ? newPasswordAgain : undefined);

  async function handleChangeDefaultPassword() {
    if (!defaultPasswordNudge || !nudgeCheck.ok) return;
    setNudgeBusy(true);
    try {
      await changePassword(defaultPasswordNudge._id, newPassword.trim());
      setNudgeDone(true);
    } finally {
      setNudgeBusy(false);
    }
  }

  if (defaultPasswordNudge) {
    return (
      <div className="login-screen" style={{ backgroundImage: `url(${INTRO_LAST_FRAME_URL})` }}>
        <div className="login-screen__panel">
          <h1 className="login-screen__title">Change your password</h1>
          <p className="login-screen__hint">
            The account "{defaultPasswordNudge.displayName}" still has the default password it shipped with. We recommend changing it —
            you can also do it later, in the admin area.
          </p>
          {nudgeDone ? (
            <p className="login-screen__hint">Password changed.</p>
          ) : (
            <>
              <PasswordField
                className="login-screen__input"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                hint={nudgeCheck.hint ?? PASSWORD_RULES_HINT}
                error={newPassword.length > 0 && !nudgeCheck.ok ? nudgeCheck.error : null}
              />
              <PasswordField
                className="login-screen__input"
                placeholder="Repeat the new password"
                value={newPasswordAgain}
                onChange={(e) => setNewPasswordAgain(e.target.value)}
              />
            </>
          )}
          <div className="login-screen__actions">
            {!nudgeDone && (
              <button
                type="button"
                className="login-screen__button"
                onClick={handleChangeDefaultPassword}
                disabled={nudgeBusy || !nudgeCheck.ok}
              >
                Change password
              </button>
            )}
            <button type="button" className="login-screen__button login-screen__button--secondary" onClick={onContinue}>
              {nudgeDone ? "Continue" : "Dismiss and continue"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (usersLoaded && users.length === 0) {
    return (
      <div className="login-screen" style={{ backgroundImage: `url(${INTRO_LAST_FRAME_URL})` }}>
        <div className="login-screen__panel">
          <h1 className="login-screen__title">No accounts</h1>
          <p className="login-screen__hint">
            No accounts are set up on this computer — there is nothing to sign in with yet. This happens
            after reinstalling the app or if the accounts database was lost.
          </p>
          <p className="login-screen__hint">
            If you have a copy of the accounts (an <code>aurora-system-backup-…json</code> file from
            the <code>backups</code> folder next to the app), restore it — the accounts,
            passwords and the log will come back. If there is no copy, contact whoever installed
            the app.
          </p>
          <div className="login-screen__actions">
            <button type="button" className="login-screen__button" onClick={onContinue}>
              Continue without signing in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen" style={{ backgroundImage: `url(${INTRO_LAST_FRAME_URL})` }}>
      <form className="login-screen__panel" onSubmit={handleSubmit}>
        <h1 className="login-screen__title">Aurora</h1>
        <p className="login-screen__hint">The centre&apos;s working materials, offline</p>

        <select
          className="login-screen__input"
          value={selectedLogin}
          onChange={(e) => setSelectedLogin(e.target.value)}
        >
          {users.map((user) => (
            <option key={user._id} value={user.login}>
              {user.displayName}
            </option>
          ))}
        </select>
        <PasswordField
          className="login-screen__input"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="login-screen__error">{error}</p>}
        <button type="submit" className="login-screen__button" disabled={busy || !password}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
      <p className="login-screen__version">Aurora {APP_VERSION}</p>
    </div>
  );
}
