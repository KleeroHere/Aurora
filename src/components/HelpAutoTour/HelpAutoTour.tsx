import { useEffect, useRef } from "react";
import { useCurrentUser } from "../../context/CurrentUserContext";
import { useHelp } from "../../help/HelpContext";
import { updateUserPreferences } from "../../data/repository";

export default function HelpAutoTour() {
  const { currentUser } = useCurrentUser();
  const { startTour } = useHelp();
  const handledFor = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      handledFor.current = null;
      return;
    }
    if (handledFor.current === currentUser._id) return;
    handledFor.current = currentUser._id;

    if (currentUser.preferences?.tourSeenAt) return;

    const timer = window.setTimeout(() => {
      startTour();
      updateUserPreferences(currentUser._id, { tourSeenAt: new Date().toISOString() }).catch(() => {
      });
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [currentUser, startTour]);

  return null;
}
