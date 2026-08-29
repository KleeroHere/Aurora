import { publicUrl } from "./publicUrl";

export interface ChangelogEntry {
  version: string;
  /** "YYYY-MM-DD". */
  date: string;
  title: string;
  items: string[];
}

const CHANGELOG_URL = publicUrl("content/changelog.json");
const LAST_SEEN_STORAGE_KEY = "aurora.changelog.lastSeenVersion";

export async function loadChangelog(): Promise<ChangelogEntry[] | null> {
  try {
    const response = await fetch(CHANGELOG_URL);
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return data as ChangelogEntry[];
  } catch {
    return null;
  }
}

export function getLastSeenChangelogVersion(): string | null {
  return window.localStorage.getItem(LAST_SEEN_STORAGE_KEY);
}

export function markChangelogSeen(version: string): void {
  window.localStorage.setItem(LAST_SEEN_STORAGE_KEY, version);
}

export function isVersionUnread(entries: ChangelogEntry[], lastSeenVersion: string | null): boolean {
  if (entries.length === 0) return false;
  return lastSeenVersion !== entries[0].version;
}

export function hasUnreadChangelog(entries: ChangelogEntry[]): boolean {
  return isVersionUnread(entries, getLastSeenChangelogVersion());
}
