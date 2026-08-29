import { useState } from "react";
import type { FormEvent } from "react";
import { Outlet } from "react-router-dom";
import { login } from "../../data/repository";
import { useCurrentUser } from "../../context/CurrentUserContext";
import PasswordField from "../PasswordField/PasswordField";
import "./AdminGate.css";

export default function AdminGate() {
  const { currentUser } = useCurrentUser();
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (unlocked) return <Outlet />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!currentUser || !password) return;
    setBusy(true);
    setError(null);
    try {
      const result = await login(currentUser.login, password);
      if (!result) {
        setError("Incorrect password.");
        return;
      }
      setUnlocked(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-gate">
      <form className="admin-gate__panel surface-glass-blur" onSubmit={handleSubmit}>
        <h1 className="admin-gate__title">Confirm your password</h1>
        <p className="admin-gate__hint">
          Entering the admin area requires re-entering the password{currentUser ? ` for "${currentUser.displayName}"` : ""},
          even if a session is already open.
        </p>
        <PasswordField
          className="admin-gate__input"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="admin-gate__error">{error}</p>}
        <div className="admin-gate__actions">
          <button type="submit" className="admin-gate__button" disabled={busy || !password}>
            {busy ? "Checking…" : "Confirm"}
          </button>
        </div>
      </form>
    </div>
  );
}
