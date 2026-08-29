import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  createFileMaterial,
  createMaterial,
  getAllTags,
  getSections,
  pickLocalFile,
} from "../data/repository";
import type { EditorJsOutputData, Section } from "../data/types";
import TagEditor from "../components/TagEditor/TagEditor";
import { orderTagsForDisplay } from "../utils/tagColor";
import { useCurrentUser } from "../context/CurrentUserContext";
import "./MaterialCreatePage.css";
import { humanError } from "../utils/humanText";
import { ALLOWED_ORIGINAL_EXTS, type PickedFile } from "../data/fileMaterialDraft";
import { readPdfIntake } from "../data/pdfIntake";

function emptyArticleBody(): EditorJsOutputData {
  return { time: Date.now(), blocks: [], version: "2.31.6" };
}

function sectionDepth(section: Section, byId: Map<string, Section>): number {
  let depth = 0;
  let current = section;
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    depth += 1;
    current = parent;
  }
  return depth;
}

const CREATABLE_TYPES = [
  { value: "article", label: "Article", hint: "Text in the block editor — written right in the app." },
  { value: "form", label: "Form", hint: "A ready-made document: questionnaire, assignment, worksheet." },
  { value: "presentation", label: "Presentation", hint: "A ready-made presentation for a session." },
] as const;

type CreatableType = (typeof CREATABLE_TYPES)[number]["value"];

const TITLE_BY_TYPE: Record<CreatableType, string> = {
  article: "Create article",
  form: "Create form",
  presentation: "Create presentation",
};

function titleFromFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  return (dot > 0 ? name.slice(0, dot) : name).trim();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MaterialCreatePage() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const [searchParams] = useSearchParams();
  const preselectedSectionId = searchParams.get("section") ?? "";

  const [sections, setSections] = useState<Section[] | null>(null);
  const [type, setType] = useState<CreatableType>("article");
  const [title, setTitle] = useState("");
  const [sectionId, setSectionId] = useState(preselectedSectionId);
  const [editableTags, setEditableTags] = useState<string[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pdf, setPdf] = useState<PickedFile | null>(null);
  const [original, setOriginal] = useState<PickedFile | null>(null);
  const [coverPng, setCoverPng] = useState<Uint8Array | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [plainText, setPlainText] = useState("");
  const [picking, setPicking] = useState<"pdf" | "original" | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSections(), getAllTags()]).then(([list, tags]) => {
      if (cancelled) return;
      setSections(list);
      setKnownTags(tags);
      if (!sectionId && preselectedSectionId) setSectionId(preselectedSectionId);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!coverPng) {
      setCoverUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([coverPng.slice().buffer as ArrayBuffer], { type: "image/png" }));
    setCoverUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverPng]);

  const byId = useMemo(() => new Map((sections ?? []).map((s) => [s._id, s])), [sections]);
  const currentSection = byId.get(sectionId);
  const isFileType = type === "form" || type === "presentation";

  async function handlePickPdf() {
    setPicking("pdf");
    setError(null);
    try {
      const picked = await pickLocalFile({ label: "PDF", extensions: ["pdf"] }, "document.pdf");
      if (!picked) return;
      setPdf(picked);
      if (!title.trim()) setTitle(titleFromFileName(picked.name));
      const intake = await readPdfIntake(picked.bytes);
      setCoverPng(intake.coverPng);
      setPlainText(intake.text);
    } catch (err) {
      setError(humanError(err));
    } finally {
      setPicking(null);
    }
  }

  async function handlePickOriginal() {
    setPicking("original");
    setError(null);
    try {
      const picked = await pickLocalFile(
        { label: "Document", extensions: [...ALLOWED_ORIGINAL_EXTS] },
        "document.docx",
      );
      if (picked) setOriginal(picked);
    } catch (err) {
      setError(humanError(err));
    } finally {
      setPicking(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Enter a title for the material.");
      return;
    }
    if (!sectionId) {
      setError("Choose a section.");
      return;
    }
    if (isFileType && !pdf) {
      setError("Choose a PDF — it is what gets shown on screen and sent to print.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const primaryTag = currentSection?.primaryTag;
      const tags = orderTagsForDisplay(primaryTag ? [...editableTags, primaryTag] : editableTags, primaryTag);
      const createdBy = currentUser?.login ?? "unknown";
      const authorId = currentUser?._id;

      if (isFileType && pdf) {
        const material = await createFileMaterial({
          type,
          sectionId,
          title: trimmedTitle,
          tags,
          pdf,
          original,
          coverPng,
          plainText,
          createdBy,
          authorId,
        });
        navigate(`/material/${encodeURIComponent(material._id)}`, { state: { justCreated: true } });
        return;
      }

      const material = await createMaterial({
        type: "article",
        sectionId,
        title: trimmedTitle,
        body: emptyArticleBody(),
        tags,
        createdBy,
        authorId,
      });
      navigate(`/material/${encodeURIComponent(material._id)}/edit`, { state: { justCreated: true } });
    } catch (err) {
      setError(humanError(err));
      setCreating(false);
    }
  }

  function handleCancel() {
    if (sectionId) {
      navigate(`/section/${encodeURIComponent(sectionId)}`);
    } else {
      navigate("/");
    }
  }

  return (
    <div className="material-create-page">
      <p className="material-create-page__eyebrow">New material</p>
      <h1 className="material-create-page__title">{TITLE_BY_TYPE[type]}</h1>

      <form className="material-create-page__form" onSubmit={handleSubmit} data-help="create-form">
        <fieldset className="material-create-page__field material-create-page__types">
          <legend className="material-create-page__label">What are we creating</legend>
          {CREATABLE_TYPES.map((option) => (
            <label
              key={option.value}
              className={`material-create-page__type${type === option.value ? " material-create-page__type--active" : ""}`}
            >
              <input
                type="radio"
                name="aurora-new-material-type"
                value={option.value}
                checked={type === option.value}
                onChange={() => setType(option.value)}
                disabled={creating}
              />
              <span>
                <span className="material-create-page__type-label">{option.label}</span>
                <span className="material-create-page__type-hint">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {isFileType && (
          <div className="material-create-page__field">
            <span className="material-create-page__label">Files</span>

            <div className="material-create-page__file-row">
              <button
                type="button"
                className="material-create-page__button material-create-page__button--secondary"
                onClick={handlePickPdf}
                disabled={creating || picking !== null}
              >
                {picking === "pdf" ? "Reading file…" : pdf ? "Choose another PDF" : "Choose PDF"}
              </button>
              <span className="material-create-page__file-name">
                {pdf ? `${pdf.name} — ${formatSize(pdf.bytes.length)}` : "not selected"}
              </span>
            </div>

            <div className="material-create-page__file-row">
              <button
                type="button"
                className="material-create-page__button material-create-page__button--secondary"
                onClick={handlePickOriginal}
                disabled={creating || picking !== null}
              >
                {picking === "original"
                  ? "Reading file…"
                  : original
                    ? "Choose another source file"
                    : "Add source file (optional)"}
              </button>
              <span className="material-create-page__file-name">
                {original ? `${original.name} — ${formatSize(original.bytes.length)}` : "not selected"}
              </span>
              {original && (
                <button
                  type="button"
                  className="material-create-page__file-clear"
                  onClick={() => setOriginal(null)}
                  disabled={creating}
                >
                  remove
                </button>
              )}
            </div>

            <p className="material-create-page__hint">
              The PDF is shown on screen and sent to print. The source file (
              {ALLOWED_ORIGINAL_EXTS.join(", ")}) is only needed if the file will be edited later — it
              will be available for download. The app works offline and does not convert anything
              itself: save the document as PDF in the program it was made in.
            </p>

            {coverUrl && (
              <figure className="material-create-page__cover">
                <img src={coverUrl} alt="First page of the selected file" />
                <figcaption>This is how the material will look in the list.</figcaption>
              </figure>
            )}
            {pdf && !coverUrl && (
              <p className="material-create-page__hint">
                Could not render the first page — the material will still be created, with a plain
                icon in the list.
              </p>
            )}
          </div>
        )}

        <label className="material-create-page__field">
          <span className="material-create-page__label">Title</span>
          <input
            className="material-create-page__input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Material title"
            autoFocus
          />
        </label>

        <label className="material-create-page__field">
          <span className="material-create-page__label">Section</span>
          <select
            className="material-create-page__input"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            disabled={!sections}
          >
            <option value="">
              {sections ? "Choose a section…" : "Loading sections…"}
            </option>
            {(sections ?? []).map((section) => (
              <option key={section._id} value={section._id}>
                {"— ".repeat(sectionDepth(section, byId))}
                {section.title}
              </option>
            ))}
          </select>
        </label>

        <label className="material-create-page__field">
          <span className="material-create-page__label">Tags</span>
          <TagEditor
            tags={editableTags}
            onChange={setEditableTags}
            knownTags={knownTags}
            primaryTag={currentSection?.primaryTag}
          />
        </label>

        {error && <p className="material-create-page__error">{error}</p>}

        <div className="material-create-page__actions">
          <button
            type="button"
            className="material-create-page__button material-create-page__button--secondary"
            onClick={handleCancel}
            disabled={creating}
          >
            Cancel
          </button>
          <button type="submit" className="material-create-page__button" disabled={creating}>
            {creating ? "Creating…" : isFileType ? "Create material" : "Create and open editor"}
          </button>
        </div>
      </form>
    </div>
  );
}
