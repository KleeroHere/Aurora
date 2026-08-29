import { publicUrl } from "../utils/publicUrl";

export interface SynonymGroup {
  canonical: string;
  aliases: string[];
}

const SYNONYMS_URL = publicUrl("content/synonyms.json");

export async function loadSynonyms(): Promise<SynonymGroup[] | null> {
  try {
    const response = await fetch(SYNONYMS_URL);
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!Array.isArray(data)) return null;
    return data as SynonymGroup[];
  } catch {
    return null;
  }
}
