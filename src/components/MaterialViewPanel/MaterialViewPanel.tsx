import { useId, useRef, useState } from "react";
import type { Material, CardColor } from "../../data/types";
import { addMaterialAttachment, getMaterialAttachmentUrl, updateMaterial } from "../../data/repository";
import { resizeImageToLongSide } from "../../utils/resizeImage";
import { createObjectUrlTracker } from "../../data/objectUrlTracker";
import { useCurrentUser } from "../../context/CurrentUserContext";
import Icon from "../icons/Icon";
import "./MaterialViewPanel.css";
import { humanError } from "../../utils/humanText";

const CARD_COLOR_OPTIONS: { value: CardColor; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "green", label: "Green" },
  { value: "blue", label: "Blue" },
  { value: "red", label: "Red" },
  { value: "purple", label: "Purple" },
  { value: "pink", label: "Pink" },
];

export default function MaterialViewPanel({
  material,
  onUpdated,
}: {
  material: Material;
  onUpdated: (updated: Material) => void;
}) {
  const { currentUser } = useCurrentUser();
  const userLogin = currentUser?.login ?? "unknown";
  const authorId = currentUser?._id;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlTrackerRef = useRef(createObjectUrlTracker());
  const inputId = useId();

  async function handleColorChange(color: CardColor) {
    if (color === material.card.color) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateMaterial(material._id, {
        card: { ...material.card, color },
        updatedBy: userLogin,
        authorId,
      });
      onUpdated(updated);
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCoverPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const resized = await resizeImageToLongSide(file);
      await addMaterialAttachment(material._id, "cover", resized.type, resized);
      const updated = await updateMaterial(material._id, {
        card: { ...material.card, cover: { attachment: "cover" } },
        updatedBy: userLogin,
        authorId,
      });
      const url = urlTrackerRef.current.track(await getMaterialAttachmentUrl(material._id, "cover"));
      setCoverPreviewUrl(url);
      onUpdated(updated);
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveCover() {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateMaterial(material._id, {
        card: { ...material.card, cover: null },
        updatedBy: userLogin,
        authorId,
      });
      urlTrackerRef.current.revokeAll();
      setCoverPreviewUrl(null);
      onUpdated(updated);
    } catch (err) {
      setError(humanError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="material-view-panel surface-glass" data-card-color={material.card.color}>
      <p className="material-view-panel__eyebrow">Appearance</p>

      <div className="material-view-panel__section">
        <p className="material-view-panel__label">Card color</p>
        <div className="material-view-panel__swatches" role="radiogroup" aria-label="Card color">
          {CARD_COLOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={material.card.color === option.value}
              title={option.label}
              data-card-color={option.value}
              className={
                "material-view-panel__swatch" +
                (material.card.color === option.value ? " material-view-panel__swatch--selected" : "")
              }
              disabled={busy}
              onClick={() => handleColorChange(option.value)}
            />
          ))}
        </div>
      </div>

      <div className="material-view-panel__section">
        <p className="material-view-panel__label">Cover</p>
        <label htmlFor={inputId} className="material-view-panel__button">
          <Icon name="image" size={16} /> {material.card.cover || coverPreviewUrl ? "Replace cover" : "Cover"}
        </label>
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept="image/*"
          className="material-view-panel__file-input"
          onChange={handleCoverPick}
          disabled={busy}
        />
        {(material.card.cover || coverPreviewUrl) && (
          <button
            type="button"
            className="material-view-panel__button material-view-panel__button--danger"
            onClick={handleRemoveCover}
            disabled={busy}
          >
            <Icon name="trash" size={16} /> Remove cover
          </button>
        )}
      </div>

      {error && <p className="material-view-panel__error">Error: {error}</p>}
    </div>
  );
}
