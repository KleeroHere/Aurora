import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import ArticleEditor from "../components/ArticleEditor/ArticleEditor";
import type { ArticleEditorHandle } from "../components/ArticleEditor/ArticleEditor";
import { deleteMaterial, getAllTags, getMaterialById, getSections, updateMaterial } from "../data/repository";
import type { Article, EditorJsOutputData, Section } from "../data/types";
import TagEditor from "../components/TagEditor/TagEditor";
import { orderTagsForDisplay } from "../utils/tagColor";
import { useCurrentUser } from "../context/CurrentUserContext";
import { clearAutosaveDraft, readAutosaveDraft, useAutosave } from "../utils/useAutosave";
import type { AutosaveDraft } from "../utils/useAutosave";
import { useRipple } from "../utils/useRipple";
import "./ArticleEditPage.css";
import { humanError } from "../utils/humanText";

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default function ArticleEditPage() {
  const { materialId: rawId } = useParams<{ materialId: string }>();
  const id = rawId ? decodeURIComponent(rawId) : "";
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useCurrentUser();
  const userLogin = currentUser?.login ?? "unknown";
  const authorId = currentUser?._id;
  const justCreated = Boolean((location.state as { justCreated?: boolean } | null)?.justCreated);

  const [article, setArticle] = useState<Article | null | undefined>(undefined);
  const [editorReady, setEditorReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const editorHandleRef = useRef<ArticleEditorHandle>(null);
  const ripple = useRipple();

  const [draftGate, setDraftGate] = useState<"checking" | "prompt" | "ready">("checking");
  const [pendingDraft, setPendingDraft] = useState<AutosaveDraft | null>(null);
  const [editorInitialBody, setEditorInitialBody] = useState<EditorJsOutputData | null>(null);
  const [dirty, setDirty] = useState(false);

  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [editableTags, setEditableTags] = useState<string[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const resolvedRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setDraftGate("checking");
    getMaterialById(id).then((material) => {
      if (cancelled) return;
      if (material && material.type === "article") {
        setArticle(material);
        setSectionId(material.sectionId);
      } else {
        setArticle(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!article) return;
    const draft = readAutosaveDraft(article._id);
    if (draft && draft.savedAt > article.updatedAt) {
      setPendingDraft(draft);
      setDraftGate("prompt");
    } else {
      setEditorInitialBody(article.body);
      setDraftGate("ready");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?._id]);

  function handleRestoreDraft() {
    if (!pendingDraft) return;
    setEditorInitialBody(pendingDraft.body);
    setDraftGate("ready");
  }

  function handleDiscardDraft() {
    if (article) clearAutosaveDraft(article._id);
    setEditorInitialBody(article?.body ?? null);
    setDraftGate("ready");
  }

  const autosaveStatus = useAutosave(article?._id ?? "", draftGate === "ready", async () => {
    if (!editorHandleRef.current) return null;
    return editorHandleRef.current.save();
  });

  useEffect(() => {
    if (autosaveStatus.kind === "saved") setDirty(false);
  }, [autosaveStatus]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSections(), getAllTags()]).then(([sectionDocs, tags]) => {
      if (cancelled) return;
      setSections(sectionDocs);
      setKnownTags(tags);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentSection = useMemo(() => sections.find((s) => s._id === sectionId), [sections, sectionId]);

  useEffect(() => {
    if (!article) return;
    const originalSection = sections.find((s) => s._id === article.sectionId);
    const originalPrimaryTag = originalSection?.primaryTag;
    setEditableTags(article.tags.filter((t) => t !== originalPrimaryTag));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article, sections.length]);

  //
  useEffect(() => {
    if (!justCreated) return;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      setTimeout(() => {
        if (mountedRef.current || resolvedRef.current) return;
        resolvedRef.current = true;
        deleteMaterial(id, userLogin, authorId).catch(() => undefined);
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCreated, id]);

  async function handleSave() {
    if (!editorHandleRef.current || !article) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body = await editorHandleRef.current.save();
      const primaryTag = currentSection?.primaryTag;
      const tags = orderTagsForDisplay(primaryTag ? [...editableTags, primaryTag] : editableTags, primaryTag);
      await updateMaterial(article._id, {
        body,
        sectionId: sectionId || article.sectionId,
        tags,
        updatedBy: userLogin,
        authorId,
      });
      clearAutosaveDraft(article._id);
      resolvedRef.current = true;
      navigate(`/material/${encodeURIComponent(article._id)}`);
    } catch (err) {
      setSaveError(humanError(err));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (editorReady && !saving) void handleSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorReady, saving, article, editableTags, sectionId]);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function handleCancel() {
    if (justCreated && !resolvedRef.current && article) {
      resolvedRef.current = true;
      await deleteMaterial(article._id, userLogin, authorId).catch(() => undefined);
      navigate(`/section/${encodeURIComponent(article.sectionId)}`);
      return;
    }
    if (article) navigate(`/material/${encodeURIComponent(article._id)}`);
  }

  if (article === undefined) {
    return <p className="article-edit-page__hint">Loading…</p>;
  }

  if (article === null) {
    return (
      <div className="article-edit-page">
        <p className="article-edit-page__hint">
          Material not found, or block editing is only supported for articles.
        </p>
        <Link to="/" className="article-edit-page__back">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="article-edit-page">
      <div className="article-edit-page__header">
        <div>
          <p className="article-edit-page__eyebrow">Editing article</p>
          <h1 className="article-edit-page__title">{article.title}</h1>
        </div>
        <div className="article-edit-page__actions" data-help="editor-save">
          {(dirty || autosaveStatus.kind === "saved") && (
            <span className="article-edit-page__autosave-status">
              {dirty
                ? "Unsaved changes"
                : autosaveStatus.kind === "saved"
                  ? `Draft saved at ${formatClockTime(autosaveStatus.at)}`
                  : null}
            </span>
          )}
          <button
            type="button"
            className="article-edit-page__button article-edit-page__button--secondary"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="article-edit-page__button btn-ripple"
            onClick={(e) => {
              ripple(e);
              handleSave();
            }}
            disabled={!editorReady || saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {saveError && <p className="article-edit-page__error">Save error: {saveError}</p>}

      <div className="article-edit-page__meta-fields">
        <label className="article-edit-page__field" data-help="editor-section">
          <span className="article-edit-page__label">Section</span>
          <select
            className="article-edit-page__input"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            {sections.map((section) => (
              <option key={section._id} value={section._id}>
                {section.title}
              </option>
            ))}
          </select>
        </label>

        <label className="article-edit-page__field" data-help="editor-tags">
          <span className="article-edit-page__label">Tags</span>
          <TagEditor
            tags={editableTags}
            onChange={setEditableTags}
            knownTags={knownTags}
            primaryTag={currentSection?.primaryTag}
          />
        </label>
      </div>

      {draftGate === "prompt" && (
        <div className="article-edit-page__draft-banner" role="status">
          <p>
            An unsaved draft of this article was found (newer than the last save). Restore it in the
            editor, or discard it and continue from the last saved version?
          </p>
          <div className="article-edit-page__draft-banner-actions">
            <button
              type="button"
              className="article-edit-page__button"
              onClick={handleRestoreDraft}
            >
              Restore draft
            </button>
            <button
              type="button"
              className="article-edit-page__button article-edit-page__button--secondary"
              onClick={handleDiscardDraft}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {draftGate === "ready" && editorInitialBody && (
        <ArticleEditor
          ref={editorHandleRef}
          materialId={article._id}
          initialData={editorInitialBody}
          onReadyChange={setEditorReady}
          onDirty={() => setDirty(true)}
        />
      )}
    </div>
  );
}
