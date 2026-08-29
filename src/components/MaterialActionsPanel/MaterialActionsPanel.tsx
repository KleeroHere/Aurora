import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Material, Section } from "../../data/types";
import { deleteMaterial, getSections, restoreMaterial, updateMaterial } from "../../data/repository";
import { isSafeVideoPath, videoOfMaterial } from "../../data/videoPort";
import { selectVideoPort } from "../../data/videoPortSelect";
import { useCurrentUser } from "../../context/CurrentUserContext";
import { showToast } from "../../data/toastBus";
import { buildInternalLinkHref } from "../../data/internalLinks";
import DeleteMaterialModal from "../DeleteMaterialModal/DeleteMaterialModal";
import Icon from "../icons/Icon";
import "./MaterialActionsPanel.css";
import { humanError } from "../../utils/humanText";

const DELETE_UNDO_DURATION_MS = 10000;

export default function MaterialActionsPanel({
  material,
  section,
  onUpdated,
}: {
  material: Material;
  section: Section | undefined;
  onUpdated: (updated: Material) => void;
}) {
  const { currentUser } = useCurrentUser();
  const userLogin = currentUser?.login ?? "unknown";
  const authorId = currentUser?._id;
  const navigate = useNavigate();

  const [sections, setSections] = useState<Section[]>([]);
  const [targetSectionId, setTargetSectionId] = useState(material.sectionId);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState(material.title);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const boundVideo = videoOfMaterial(material);
  const videoEditable = material.type === "article" || material.type === "film";
  const [draftVideoPath, setDraftVideoPath] = useState(boundVideo?.path ?? "");
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoNotice, setVideoNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSections().then((docs) => {
      if (!cancelled) setSections(docs);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setTargetSectionId(material.sectionId);
  }, [material.sectionId]);

  useEffect(() => {
    setDraftTitle(material.title);
  }, [material.title]);

  useEffect(() => {
    setDraftVideoPath(videoOfMaterial(material)?.path ?? "");
    setVideoError(null);
    setVideoNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material._id]);

  async function handleRename() {
    const trimmed = draftTitle.trim();
    if (!trimmed || trimmed === material.title) return;
    setRenaming(true);
    setRenameError(null);
    try {
      const updated = await updateMaterial(material._id, { title: trimmed, updatedBy: userLogin, authorId });
      onUpdated(updated);
      showToast({ message: "Title changed. Links to the material keep working.", role: "success" });
    } catch (err) {
      setRenameError(humanError(err));
    } finally {
      setRenaming(false);
    }
  }

  async function handleBindVideo() {
    const path = draftVideoPath.trim();
    if (!path || path === (boundVideo?.path ?? "")) return;
    setVideoBusy(true);
    setVideoError(null);
    setVideoNotice(null);
    try {
      if (!isSafeVideoPath(path)) {
        throw new Error(
          "Expected a file name inside the videos folder (subfolders allowed) — no \"..\", no drive letter, and no leading slash.",
        );
      }
      const exists = await selectVideoPort()
        .then((port) => port.videoExists(path))
        .catch(() => false);
      const updated = await updateMaterial(material._id, {
        video: { path, durationSec: null, width: null, height: null, posterFrameSec: null },
        updatedBy: userLogin,
        authorId,
      });
      onUpdated(updated);
      setVideoNotice(
        exists
          ? "Video attached."
          : `Video attached, but the file videos/${path} does not exist on this machine yet — the material will say so in place of the player.`,
      );
    } catch (err) {
      setVideoError(humanError(err));
    } finally {
      setVideoBusy(false);
    }
  }

  async function handleUnbindVideo() {
    setVideoBusy(true);
    setVideoError(null);
    setVideoNotice(null);
    try {
      const updated = await updateMaterial(material._id, { video: null, updatedBy: userLogin, authorId });
      onUpdated(updated);
      setDraftVideoPath("");
      setVideoNotice("Video detached. The video file itself remains on disk.");
    } catch (err) {
      setVideoError(humanError(err));
    } finally {
      setVideoBusy(false);
    }
  }

  async function handleMove() {
    if (targetSectionId === material.sectionId) return;
    setMoving(true);
    setMoveError(null);
    try {
      const updated = await updateMaterial(material._id, { sectionId: targetSectionId, updatedBy: userLogin, authorId });
      onUpdated(updated);
    } catch (err) {
      setMoveError(humanError(err));
    } finally {
      setMoving(false);
    }
  }

  async function handleConfirmDelete() {
    setDeleteError(null);
    try {
      const snapshot = await deleteMaterial(material._id, userLogin, authorId);
      setDeleteOpen(false);
      navigate(`/section/${encodeURIComponent(material.sectionId)}`);
      showToast({
        message: `Material "${snapshot.material.title}" deleted.`,
        role: "neutral",
        durationMs: DELETE_UNDO_DURATION_MS,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await restoreMaterial(snapshot, userLogin, authorId);
              showToast({ message: `Material "${snapshot.material.title}" restored.`, role: "success" });
            } catch (err) {
              showToast({
                message: `Failed to undo: ${humanError(err)}`,
                role: "error",
              });
            }
          },
        },
      });
    } catch (err) {
      setDeleteError(humanError(err));
    }
  }

  return (
    <div className="material-actions-panel surface-glass" data-help="material-manage">
      <p className="material-actions-panel__eyebrow">Manage</p>

      <div className="material-actions-panel__section">
        <label className="material-actions-panel__label" htmlFor="material-rename-input">
          Title
        </label>
        <div className="material-actions-panel__move-row">
          <input
            id="material-rename-input"
            type="text"
            className="material-actions-panel__select"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleRename();
              }
            }}
            disabled={renaming}
          />
          <button
            type="button"
            className="material-actions-panel__button"
            onClick={handleRename}
            disabled={renaming || !draftTitle.trim() || draftTitle.trim() === material.title}
          >
            {renaming ? "Saving…" : "Rename"}
          </button>
        </div>
        {renameError && <p className="material-actions-panel__error">Error: {renameError}</p>}
      </div>

      <div className="material-actions-panel__section">
        <p className="material-actions-panel__label">Section</p>
        <div className="material-actions-panel__move-row">
          <select
            className="material-actions-panel__select"
            value={targetSectionId}
            onChange={(e) => setTargetSectionId(e.target.value)}
            disabled={moving}
          >
            {sections.map((s) => (
              <option key={s._id} value={s._id}>
                {s.title}
                {s._id === material.sectionId ? " (current)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="material-actions-panel__button"
            onClick={handleMove}
            disabled={moving || targetSectionId === material.sectionId}
          >
            {moving ? "Moving…" : "Move"}
          </button>
        </div>
        {moveError && <p className="material-actions-panel__error">Error: {moveError}</p>}
      </div>

      {videoEditable && (
        <div className="material-actions-panel__section">
          <label className="material-actions-panel__label" htmlFor="material-video-input">
            Video
          </label>
          <div className="material-actions-panel__move-row">
            <input
              id="material-video-input"
              type="text"
              className="material-actions-panel__select"
              placeholder="file name inside the videos folder"
              value={draftVideoPath}
              onChange={(e) => setDraftVideoPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleBindVideo();
                }
              }}
              disabled={videoBusy}
            />
            <button
              type="button"
              className="material-actions-panel__button"
              onClick={handleBindVideo}
              disabled={videoBusy || !draftVideoPath.trim() || draftVideoPath.trim() === (boundVideo?.path ?? "")}
            >
              {videoBusy ? "Saving…" : boundVideo ? "Replace" : "Attach"}
            </button>
          </div>
          {boundVideo && (
            <button
              type="button"
              className="material-actions-panel__button material-actions-panel__button--danger"
              onClick={handleUnbindVideo}
              disabled={videoBusy}
            >
              <Icon name="trash" size={16} /> Remove video
            </button>
          )}
          {videoNotice && <p className="material-actions-panel__hint">{videoNotice}</p>}
          {videoError && <p className="material-actions-panel__error">Error: {videoError}</p>}
        </div>
      )}

      <div className="material-actions-panel__section">
        <button
          type="button"
          className="material-actions-panel__button"
          onClick={async () => {
            const href = buildInternalLinkHref(material._id);
            try {
              await navigator.clipboard.writeText(href);
            } catch {
              const area = document.createElement("textarea");
              area.value = href;
              document.body.appendChild(area);
              area.select();
              document.execCommand("copy");
              area.remove();
            }
            showToast({ message: "Link to the material copied — paste it into the text of any article" });
          }}
        >
          <Icon name="link" size={16} /> Copy link to material
        </button>
      </div>

      <div className="material-actions-panel__section">
        <button
          type="button"
          className="material-actions-panel__button material-actions-panel__button--danger"
          onClick={() => setDeleteOpen(true)}
        >
          <Icon name="trash" size={16} /> Delete material
        </button>
        {deleteError && <p className="material-actions-panel__error">Error: {deleteError}</p>}
      </div>

      {deleteOpen && (
        <DeleteMaterialModal
          material={material}
          section={section}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}
