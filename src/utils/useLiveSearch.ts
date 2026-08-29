import { useEffect, useState } from "react";
import { getMaterialsByTag, getSearchSuggestions, searchMaterials } from "../data/repository";
import type { MatchField } from "../data/searchIndex";
import type { MaterialSummary } from "../data/types";

export interface SearchResultItem {
  summary: MaterialSummary;
  matchedFields: MatchField[];
}

export function useLiveSearch(
  query: string,
): { results: SearchResultItem[]; isTagQuery: boolean; suggestions: string[] } {
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const trimmed = query.trim();
  const isTagQuery = trimmed.startsWith("#");

  useEffect(() => {
    if (!trimmed) {
      setResults([]);
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const tagName = trimmed.replace(/^#/, "").trim();

    if (isTagQuery && tagName) {
      getMaterialsByTag(`#${tagName}`).then((found) => {
        if (cancelled) return;
        setResults(found.map((summary) => ({ summary, matchedFields: ["tags"] as MatchField[] })));
        setSuggestions([]);
      });
    } else {
      searchMaterials(trimmed).then((hits) => {
        if (cancelled) return;
        setResults(hits.map((hit) => ({ summary: hit.summary, matchedFields: hit.matchedFields })));
        if (hits.length === 0) {
          getSearchSuggestions(trimmed).then((found) => {
            if (!cancelled) setSuggestions(found);
          });
        } else {
          setSuggestions([]);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [trimmed, isTagQuery]);

  return { results, isTagQuery, suggestions };
}
