import { seededRandom } from "./seededRandom";

const CANONICAL_COLORS: Record<string, string> = {
  "#crisis": "var(--tag-1)",
  "#therapy": "var(--tag-2)",
  "#communication": "var(--tag-3)",
  "#regulations": "var(--tag-4)",
  "#documents": "var(--tag-5)",
  "#chores": "var(--tag-6)",
};

const NEUTRAL_VARIANTS = ["var(--tag-free-1)", "var(--tag-free-2)", "var(--tag-free-3)"] as const;

export function tagColorVar(tag: string): string {
  const canonical = CANONICAL_COLORS[tag];
  if (canonical) return canonical;
  const rand = seededRandom(`tag:${tag}`);
  return NEUTRAL_VARIANTS[Math.floor(rand() * NEUTRAL_VARIANTS.length)];
}

export const CANONICAL_TAG_ORDER = ["#crisis", "#therapy", "#communication", "#regulations", "#documents", "#chores"];

export function orderTagsForDisplay(tags: string[], primaryTag?: string): string[] {
  const set = new Set(tags);
  const canonical = CANONICAL_TAG_ORDER.filter((t) => set.has(t));
  const rest = tags.filter((t) => !CANONICAL_TAG_ORDER.includes(t) && t !== primaryTag);
  const primary = primaryTag && set.has(primaryTag) ? [primaryTag] : [];
  return [...canonical, ...rest, ...primary];
}
