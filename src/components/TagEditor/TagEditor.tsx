import { useMemo, useState } from "react";
import { CANONICAL_TAG_ORDER } from "../../utils/tagColor";
import "./TagEditor.css";

function normalizeTag(raw: string): string {
  const trimmed = raw.trim().toLowerCase().replace(/^#/, "");
  return trimmed ? `#${trimmed}` : "";
}

export default function TagEditor({
  tags,
  onChange,
  knownTags,
  primaryTag,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  knownTags: string[];
  primaryTag?: string;
}) {
  const [draft, setDraft] = useState("");

  const suggestions = useMemo(() => {
    const query = normalizeTag(draft);
    if (!query || query === "#") return [];
    return knownTags.filter((t) => t.startsWith(query) && !tags.includes(t)).slice(0, 8);
  }, [draft, knownTags, tags]);

  function addTag(raw: string) {
    const normalized = normalizeTag(raw);
    if (!normalized || normalized === "#" || tags.includes(normalized)) {
      setDraft("");
      return;
    }
    onChange([...tags, normalized]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(draft);
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className="tag-editor">
      <div className="tag-editor__chips">
        {primaryTag && (
          <span className="tag-editor__chip tag-editor__chip--primary" title="Section tag — cannot be removed manually">
            #{primaryTag}
          </span>
        )}
        {tags.map((tag) => (
          <span key={tag} className="tag-editor__chip">
            {tag}
            <button
              type="button"
              className="tag-editor__remove"
              aria-label={`Remove tag ${tag}`}
              onClick={() => removeTag(tag)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="tag-editor__input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => draft && addTag(draft)}
          placeholder="Add a tag…"
        />
      </div>

      {suggestions.length > 0 && (
        <ul className="tag-editor__suggestions surface-glass-blur">
          {suggestions.map((tag) => (
            <li key={tag}>
              <button type="button" onClick={() => addTag(tag)}>
                {tag}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="tag-editor__presets">
        {CANONICAL_TAG_ORDER.map((tag) => (
          <button
            key={tag}
            type="button"
            className="tag-editor__preset"
            disabled={tags.includes(tag)}
            onClick={() => addTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
