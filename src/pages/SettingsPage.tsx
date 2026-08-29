import { useState } from "react";
import type { FormEvent } from "react";
import { changePassword } from "../data/repository";
import { useCurrentUser } from "../context/CurrentUserContext";
import AppearanceSettings from "../components/AppearanceSettings/AppearanceSettings";
import UpdateCheck from "../components/UpdateCheck/UpdateCheck";
import PasswordField from "../components/PasswordField/PasswordField";
import { PASSWORD_RULES_HINT, checkPassword } from "../data/passwordRules";
import "./SettingsPage.css";
import { humanError } from "../utils/humanText";

function PasswordSection() {
  const { currentUser } = useCurrentUser();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = checkPassword(newPassword, confirmPassword.length > 0 ? confirmPassword : undefined);
  const showCheckError = newPassword.length > 0 && !check.ok;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!currentUser || !check.ok) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await changePassword(currentUser._id, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Password changed.");
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-page__section">
      <h2 className="settings-page__section-title">Password</h2>
      <p className="settings-page__section-hint">Change the password for account "{currentUser?.displayName}".</p>
      <form className="settings-page__password-form" onSubmit={handleSubmit}>
        <PasswordField
          className="settings-page__input"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          hint={check.hint ?? PASSWORD_RULES_HINT}
          error={showCheckError ? check.error : null}
        />
        <PasswordField
          className="settings-page__input"
          placeholder="Repeat new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
        <button
          type="submit"
          className="settings-page__button"
          disabled={busy || !check.ok}
        >
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
      {notice && <p className="settings-page__notice">{notice}</p>}
      {error && <p className="settings-page__error">Error: {error}</p>}
    </section>
  );
}

export default function SettingsPage() {
  return (
    <div className="settings-page">
      <p className="settings-page__eyebrow">Settings</p>
      <h1 className="settings-page__title">Personal settings</h1>
      <p className="settings-page__lead">
        Appearance and your own password. Moving the database between machines and other database
        operations live in the admin area.
      </p>

      <section className="settings-page__section">
        <h2 className="settings-page__section-title">Appearance</h2>
        <p className="settings-page__section-hint">Applied immediately, no reload needed.</p>
        <AppearanceSettings />
      </section>

      <PasswordSection />

      <UpdateCheck />
    </div>
  );
}
