import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getSections } from "../data/repository";
import type { Section } from "../data/types";
import { useLiveSearch } from "../utils/useLiveSearch";
import { findHighlight, matchReasonLabel } from "../utils/searchHighlight";
import { orderTagsForDisplay } from "../utils/tagColor";
import TagChip from "../components/TagChip/TagChip";
import "./SearchPage.css";

export default function SearchPage() {
  const { query: rawQuery } = useParams<{ query: string }>();
  const query = rawQuery ? decodeURIComponent(rawQuery) : "";
  const { results, isTagQuery } = useLiveSearch(query);
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    getSections().then(setSections);
  }, []);

  const sectionTitles = Object.fromEntries(sections.map((s) => [s._id, s.title]));

  return (
    <div className="search-page">
      <p className="search-page__eyebrow">Search</p>
      <h1 className="search-page__title">
        {isTagQuery ? `Materials tagged ${query}` : `Results for "${query}"`}
      </h1>
      <p className="search-page__count">
        {results.length === 0
          ? "Nothing found."
          : `Materials found: ${results.length}.`}
      </p>

      <ul className="search-page__list">
        {results.map(({ summary, matchedFields }) => {
          const leadingTag = orderTagsForDisplay(summary.tags)[0];
          const reason = matchReasonLabel(matchedFields);
          const highlight = isTagQuery ? null : findHighlight(summary.title, query);
          return (
            <li key={summary._id} className="search-page__item">
              <Link className="search-page__link" to={`/material/${encodeURIComponent(summary._id)}`}>
                <span className="search-page__item-title">
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
                <span className="search-page__item-meta">
                  {leadingTag && <TagChip tag={leadingTag} interactive={false} />}
                  <Link
                    className="search-page__item-section"
                    to={`/section/${encodeURIComponent(summary.sectionId)}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {sectionTitles[summary.sectionId] ?? summary.sectionId}
                  </Link>
                  {reason && <span className="search-page__item-reason">{reason}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
