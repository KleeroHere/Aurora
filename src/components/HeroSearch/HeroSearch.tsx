import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { MaterialSummary } from "../../data/types";
import SearchInput from "../SearchInput/SearchInput";
import TagChip from "../TagChip/TagChip";
import { orderTagsForDisplay } from "../../utils/tagColor";
import { useLiveSearch } from "../../utils/useLiveSearch";
import { findHighlight, matchReasonLabel } from "../../utils/searchHighlight";
import "./HeroSearch.css";

export default function HeroSearch() {
  const [query, setQuery] = useState("");
  const { results, isTagQuery, suggestions } = useLiveSearch(query);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function openMaterial(material: MaterialSummary) {
    setQuery("");
    navigate(`/material/${encodeURIComponent(material._id)}`);
  }

  return (
    <div className="hero-search" ref={containerRef} data-help="home-search">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="What are you looking for? A material title or a #tag…"
        aria-label="Search all materials"
      />
      {query.trim().length > 0 && (
        <ul className="hero-search__results surface-glass-blur">
          {isTagQuery && (
            <li className="hero-search__hint">Tag search — start the line with #, for example #crisis</li>
          )}
          {results.length === 0 && (
            <li className="hero-search__empty">
              <p>Nothing found.</p>
              {isTagQuery ? (
                <button type="button" className="hero-search__empty-button" onClick={() => setQuery("")}>
                  Clear the tag search
                </button>
              ) : (
                <>
                  <button type="button" className="hero-search__empty-button" onClick={() => setQuery("")}>
                    Clear the search
                  </button>
                  {suggestions.length > 0 && (
                    <p className="hero-search__suggestions">
                      Did you mean:{" "}
                      {suggestions.map((s, i) => (
                        <span key={s}>
                          <button type="button" className="hero-search__suggestion" onClick={() => setQuery(s)}>
                            {s}
                          </button>
                          {i < suggestions.length - 1 && ", "}
                        </span>
                      ))}
                    </p>
                  )}
                </>
              )}
            </li>
          )}
          {results.map(({ summary, matchedFields }) => {
            const leadingTag = orderTagsForDisplay(summary.tags)[0];
            const reason = matchReasonLabel(matchedFields);
            const highlight = findHighlight(summary.title, query);
            return (
              <li key={summary._id}>
                <button type="button" className="hero-search__result" onClick={() => openMaterial(summary)}>
                  <span className="hero-search__result-title">
                    {highlight ? (
                      <>
                        {highlight.before}
                        <mark className="search-highlight">{highlight.match}</mark>
                        {highlight.after}
                      </>
                    ) : (
                      summary.title
                    )}
                  </span>
                  {leadingTag && <TagChip tag={leadingTag} interactive={false} />}
                  {reason && <span className="hero-search__result-reason">{reason}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
