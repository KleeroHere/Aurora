import MiniSearch from "minisearch";
import { newStemmer } from "snowball-stemmers";
import type { MaterialSummary } from "./types";
import type { SynonymGroup } from "./synonyms";

interface SearchDoc {
  id: string;
  title: string;
  plainText: string;
  tags: string;
}

export type MatchField = "title" | "tags" | "plainText";

export interface SearchHit {
  summary: MaterialSummary;
  matchedFields: MatchField[];
  viaSynonym: boolean;
}

const stemmer = newStemmer("english");

function stemTerm(term: string): string {
  return stemmer.stem(term.toLowerCase());
}

function fuzzyByStemmedLength(term: string): number {
  const length = term.length;
  if (length <= 3) return 0;
  if (length <= 7) return 1;
  return 2;
}

function normalizeSynonymWord(word: string): string {
  return stemTerm(word.trim());
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-zа-яё0-9]+/i)
    .filter(Boolean);
}

export function createMaterialSearchIndex() {
  const mini = new MiniSearch<SearchDoc>({
    idField: "id",
    fields: ["title", "plainText", "tags"],
    storeFields: ["title"],
    processTerm: (term) => stemTerm(term),
    searchOptions: {
      prefix: true,
      fuzzy: fuzzyByStemmedLength,
      boost: { title: 3, tags: 2 },
    },
  });

  const summaries = new Map<string, MaterialSummary>();

  let synonymLookup = new Map<string, string[]>();

  function upsert(summary: MaterialSummary, plainText: string): void {
    if (mini.has(summary._id)) {
      mini.discard(summary._id);
    }
    mini.add({ id: summary._id, title: summary.title, plainText, tags: summary.tags.join(" ") });
    summaries.set(summary._id, summary);
  }

  function remove(id: string): void {
    if (mini.has(id)) mini.discard(id);
    summaries.delete(id);
  }

  function toHit(result: { id: string; match: Record<string, string[]> }, viaSynonym: boolean): SearchHit | null {
    const summary = summaries.get(result.id);
    if (!summary) return null;
    const fields = new Set<MatchField>();
    for (const matchedIn of Object.values(result.match)) {
      for (const field of matchedIn) fields.add(field as MatchField);
    }
    return { summary, matchedFields: [...fields], viaSynonym };
  }

  function search(query: string): SearchHit[] {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const seen = new Set<string>();
    const hits: SearchHit[] = [];
    for (const result of mini.search(trimmed)) {
      const hit = toHit(result, false);
      if (!hit) continue;
      seen.add(result.id);
      hits.push(hit);
    }

    if (synonymLookup.size > 0) {
      const expansions = new Set<string>();
      for (const stem of tokenizeQuery(trimmed).map(stemTerm)) {
        for (const alt of synonymLookup.get(stem) ?? []) expansions.add(alt);
      }
      for (const alt of expansions) {
        for (const result of mini.search(alt)) {
          if (seen.has(result.id)) continue;
          const hit = toHit(result, true);
          if (!hit) continue;
          seen.add(result.id);
          hits.push(hit);
        }
      }
    }

    return hits;
  }

  function suggest(query: string, limit = 3): string[] {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return mini
      .autoSuggest(trimmed)
      .filter((s) => s.suggestion.toLowerCase() !== trimmed.toLowerCase())
      .slice(0, limit)
      .map((s) => s.suggestion);
  }

  function setSynonyms(groups: SynonymGroup[] | null): void {
    const next = new Map<string, string[]>();
    for (const group of groups ?? []) {
      const members = [group.canonical, ...group.aliases];
      for (const member of members) {
        const key = normalizeSynonymWord(member);
        const others = members.filter((m) => m !== member);
        if (others.length > 0) next.set(key, others);
      }
    }
    synonymLookup = next;
  }

  function searchByTag(tag: string): MaterialSummary[] {
    const bare = tag.replace(/^#/, "");
    return [...summaries.values()].filter((doc) => doc.tags.some((t) => t.replace(/^#/, "") === bare));
  }

  function allTags(): string[] {
    const set = new Set<string>();
    for (const doc of summaries.values()) {
      for (const tag of doc.tags) set.add(tag);
    }
    return [...set].sort();
  }

  function clear(): void {
    for (const id of summaries.keys()) mini.discard(id);
    summaries.clear();
  }

  return { upsert, remove, search, searchByTag, allTags, suggest, setSynonyms, clear };
}

export type MaterialSearchIndex = ReturnType<typeof createMaterialSearchIndex>;
