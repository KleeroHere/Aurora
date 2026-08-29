import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { MAX_PINS, getPinnedCount, isMaterialPinned, pinMaterial, unpinMaterial } from "../../data/repository";
import { onPinsChanged } from "../../data/pinsBus";
import { showToast } from "../../data/toastBus";
import { useCurrentUser } from "../../context/CurrentUserContext";
import Icon from "../icons/Icon";
import "./PinButton.css";
import { humanError } from "../../utils/humanText";

export default function PinButton({
  materialId,
  variant = "icon",
  className,
}: {
  materialId: string;
  variant?: "icon" | "labeled";
  className?: string;
}) {
  const { currentUser } = useCurrentUser();
  const userId = currentUser?._id ?? null;
  const navigate = useNavigate();
  const [pinned, setPinned] = useState(false);
  const [pinnedCount, setPinnedCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    function refresh() {
      isMaterialPinned(userId!, materialId).then((value) => {
        if (!cancelled) setPinned(value);
      });
      if (variant === "labeled") {
        getPinnedCount(userId!).then((count) => {
          if (!cancelled) setPinnedCount(count);
        });
      }
    }

    refresh();
    const unsubscribe = onPinsChanged(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId, materialId, variant]);

  if (!userId) return null;

  async function toggle(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (pinned) {
        await unpinMaterial(userId!, materialId);
        showToast({ message: "Removed from the quick-access shelf.", role: "neutral" });
      } else {
        await pinMaterial(userId!, materialId);
        showToast({
          message: "Pinned to the quick-access shelf.",
          role: "success",
          action: { label: "Show shelf", onClick: () => navigate("/") },
        });
      }
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  const label = pinned ? "Unpin" : "Pin";
  const atLimit = !pinned && pinnedCount !== null && pinnedCount >= MAX_PINS;

  if (variant === "icon") {
    return (
      <button
        type="button"
        className="pin-button pin-button--icon"
        data-pinned={pinned}
        onClick={toggle}
        disabled={busy}
        title={label}
        aria-label={label}
        aria-pressed={pinned}
      >
        <Icon name="pin" size={14} />
      </button>
    );
  }

  return (
    <div className="pin-button-labeled-wrap">
      <button
        type="button"
        className={"pin-button pin-button--labeled" + (className ? ` ${className}` : "")}
        data-pinned={pinned}
        onClick={toggle}
        disabled={busy || atLimit}
        aria-pressed={pinned}
        title={atLimit ? `You can pin at most ${MAX_PINS} materials` : label}
      >
        <Icon name="pin" size={16} />
        {label}
        {pinnedCount !== null && ` (${pinnedCount}/${MAX_PINS})`}
      </button>
      {error && <p className="pin-button__error">Error: {error}</p>}
    </div>
  );
}
