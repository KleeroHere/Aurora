import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "../../context/CurrentUserContext";
import { changePassword } from "../../data/repository";
import { resolveGlyphColorKey } from "../../utils/glyphParams";
import PasswordField from "../PasswordField/PasswordField";
import { PASSWORD_RULES_HINT, checkPassword } from "../../data/passwordRules";
import "./UserAvatar.css";

export default function UserAvatar() {
  const { currentUser } = useCurrentUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordDone, setPasswordDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
    setChangingPassword(false);
    setNewPassword("");
    setPasswordDone(false);
  }

  const passwordCheck = checkPassword(newPassword);

  async function handleChangePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    if (!currentUser || !passwordCheck.ok) return;
    setBusy(true);
    try {
      await changePassword(currentUser._id, newPassword.trim());
      setPasswordDone(true);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    window.location.reload();
  }

  if (!currentUser) return null;

  const colorKey = resolveGlyphColorKey(currentUser._id, "neutral");
  const initial = currentUser.displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="user-avatar" ref={containerRef} data-help="user-avatar">
      <button
        type="button"
        className="user-avatar__circle"
        style={{
          backgroundImage: `linear-gradient(135deg, var(--glyph-pair-${colorKey}-from), var(--glyph-pair-${colorKey}-to))`,
        }}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={currentUser.displayName}
      >
        {initial}
      </button>

      {open && (
        <div className="user-avatar__menu surface-glass-blur" role="menu">
          <p className="user-avatar__menu-name">{currentUser.displayName}</p>

          {changingPassword ? (
            passwordDone ? (
              <p className="user-avatar__menu-hint">Password changed.</p>
            ) : (
              <form className="user-avatar__password-form" onSubmit={handleChangePasswordSubmit}>
                <PasswordField
                  className="user-avatar__password-input"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                  hint={passwordCheck.hint ?? PASSWORD_RULES_HINT}
                  error={newPassword.length > 0 && !passwordCheck.ok ? passwordCheck.error : null}
                />
                <button type="submit" className="user-avatar__menu-item" disabled={busy || !passwordCheck.ok}>
                  Save password
                </button>
              </form>
            )
          ) : (
            <button type="button" className="user-avatar__menu-item" role="menuitem" onClick={() => setChangingPassword(true)}>
              Change password
            </button>
          )}

          <button
            type="button"
            className="user-avatar__menu-item"
            role="menuitem"
            onClick={() => {
              closeMenu();
              navigate("/settings");
            }}
          >
            Appearance
          </button>
          <button
            type="button"
            className="user-avatar__menu-item"
            role="menuitem"
            onClick={() => {
              closeMenu();
              navigate("/admin");
            }}
          >
            Admin
          </button>
          <button type="button" className="user-avatar__menu-item user-avatar__menu-item--danger" role="menuitem" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
