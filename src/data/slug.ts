import { ulid } from "./ulid";

const TRANSLIT_TABLE: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function transliterate(input: string): string {
  let out = "";
  for (const ch of input.toLowerCase()) {
    out += TRANSLIT_TABLE[ch] ?? ch;
  }
  return out;
}

export function slugify(input: string): string {
  const translit = transliterate(input);
  const dashed = translit.replace(/[^a-z0-9]+/g, "-");
  return dashed.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

export function buildSectionId(slug: string): string {
  return `section:${slug}`;
}

export function buildMigratedMaterialId(
  type: string,
  sectionSlug: string,
  nameSlug: string,
): string {
  return `${type}:${sectionSlug}__${nameSlug}`;
}

export function generateShortId(): string {
  return ulid().slice(-6).toLowerCase();
}

export function buildAppMaterialId(
  type: string,
  sectionSlug: string,
  title: string,
): string {
  const titleSlug = slugify(title);
  return `${type}:${sectionSlug}__${titleSlug}-${generateShortId()}`;
}

export function sectionSlugFromId(sectionId: string): string {
  return sectionId.split(":")[1] ?? "";
}
