import { useEffect, useRef } from "react";
import { useCurrentUser } from "../../context/CurrentUserContext";
import { DEFAULT_PALETTE, resolveDefaultScheme, useTheme } from "../../context/ThemeContext";
import { updateUserPreferences } from "../../data/repository";
import { resolveAppearance } from "../../data/userAppearance";
import type { Appearance } from "../../data/userAppearance";

export default function UserPreferencesSync() {
  const { currentUser } = useCurrentUser();
  const { palette, theme, setPalette, setTheme } = useTheme();
  const appliedFor = useRef<string | null>(null);
  const pending = useRef<Appearance | null>(null);

  useEffect(() => {
    if (!currentUser) {
      appliedFor.current = null;
      pending.current = null;
      return;
    }
    if (appliedFor.current === currentUser._id) return;

    const appearance = resolveAppearance(currentUser.preferences, {
      palette: DEFAULT_PALETTE,
      scheme: resolveDefaultScheme(),
    });
    pending.current = appearance;
    setPalette(appearance.palette);
    setTheme(appearance.scheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !pending.current) return;
    if (pending.current.palette === palette && pending.current.scheme === theme) {
      pending.current = null;
      appliedFor.current = currentUser._id;
    }
  }, [currentUser, palette, theme]);

  useEffect(() => {
    if (!currentUser || appliedFor.current !== currentUser._id) return;
    const same = currentUser.preferences?.palette === palette && currentUser.preferences?.scheme === theme;
    if (same) return;
    updateUserPreferences(currentUser._id, { palette, scheme: theme }).catch(() => {
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette, theme, currentUser]);

  return null;
}
