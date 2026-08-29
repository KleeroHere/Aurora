import type { MatchField } from "../data/searchIndex";

export function matchReasonLabel(fields: MatchField[]): string | null {
  if (fields.includes("title")) return "match in the title";
  if (fields.includes("tags")) return "match in a tag";
  if (fields.includes("plainText")) return "match in the text";
  return null;
}

export interface HighlightSpan {
  before: string;
  match: string;
  after: string;
}

export function findHighlight(text: string, query: string): HighlightSpan | null {
  const needle = query.trim();
  if (!needle) return null;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) return null;
  return {
    before: text.slice(0, index),
    match: text.slice(index, index + needle.length),
    after: text.slice(index + needle.length),
  };
}
