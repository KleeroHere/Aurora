import { publicUrl } from "./publicUrl";

export interface AffirmationEntry {
  day: string;
  text: string;
}

const AFFIRMATIONS_URL = publicUrl("content/affirmations.json");
const HIDDEN_STORAGE_KEY = "aurora.affirmation.hidden";

export function isAffirmationHidden(): boolean {
  return window.localStorage.getItem(HIDDEN_STORAGE_KEY) === "true";
}

export function setAffirmationHidden(hidden: boolean): void {
  if (hidden) {
    window.localStorage.setItem(HIDDEN_STORAGE_KEY, "true");
  } else {
    window.localStorage.removeItem(HIDDEN_STORAGE_KEY);
  }
}

function dayKey(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

export function pickAffirmationForDate(entries: AffirmationEntry[], date: Date): AffirmationEntry | null {
  const key = dayKey(date);
  return entries.find((entry) => entry.day === key) ?? null;
}

export async function loadAffirmations(): Promise<AffirmationEntry[] | null> {
  try {
    const response = await fetch(AFFIRMATIONS_URL);
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return null;
    return data as AffirmationEntry[];
  } catch {
    return null;
  }
}
