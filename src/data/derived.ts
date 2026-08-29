import type { EditorJsListItem, EditorJsOutputData } from "./types";

function flattenListItems(items: EditorJsListItem[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    out.push(item.content);
    if (item.items && item.items.length > 0) {
      out.push(...flattenListItems(item.items));
    }
  }
  return out;
}

function stripInlineTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
}

export function extractPlainTextFromBlocks(data: EditorJsOutputData | null | undefined): string {
  if (!data || !Array.isArray(data.blocks)) return "";
  const parts: string[] = [];

  for (const block of data.blocks) {
    switch (block.type) {
      case "header":
        parts.push(block.data.text);
        break;
      case "paragraph":
        parts.push(block.data.text);
        break;
      case "quote":
        parts.push(block.data.text, block.data.caption);
        break;
      case "alert":
        parts.push(block.data.text);
        break;
      case "list":
        parts.push(...flattenListItems(block.data.items));
        break;
      case "image":
        parts.push(block.data.caption);
        break;
      case "attaches":
        parts.push(block.data.title);
        break;
      case "table":
        for (const row of block.data.content) parts.push(...row);
        break;
      default:
        break;
    }
  }

  return stripInlineTags(parts.filter(Boolean).join(" "))
    .replace(/\s+/g, " ")
    .trim();
}

export function computeExcerpt(plainText: string, maxLen = 180): string {
  const trimmed = plainText.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  const safe = lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${safe.trim()}…`;
}

export function computeReadingTime(plainText: string): number {
  const words = plainText.trim().length === 0 ? 0 : plainText.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 180));
}

export interface ArticleDerivedFields {
  plainText: string;
  excerpt: string;
  readingTime: number;
}

export function computeArticleDerivedFields(body: EditorJsOutputData): ArticleDerivedFields {
  const plainText = extractPlainTextFromBlocks(body);
  return {
    plainText,
    excerpt: computeExcerpt(plainText),
    readingTime: computeReadingTime(plainText),
  };
}

export interface FilmDerivedFields {
  plainText: string;
  readingTime: number | null;
}

export function computeFilmDerivedFields(
  intro: EditorJsOutputData,
  questions: EditorJsOutputData,
): FilmDerivedFields {
  const introText = extractPlainTextFromBlocks(intro);
  const questionsText = extractPlainTextFromBlocks(questions);
  const plainText = [introText, questionsText].filter(Boolean).join(" ");
  return {
    plainText,
    readingTime: introText ? computeReadingTime(introText) : null,
  };
}

export function computeFileDerivedFields(
  title: string,
  currentPlainText?: string,
  previousTitle?: string,
): { plainText: string; excerpt: string | null } {
  if (!currentPlainText) return { plainText: title, excerpt: null };
  if (previousTitle !== undefined && currentPlainText.trim() === previousTitle.trim()) {
    return { plainText: title, excerpt: null };
  }
  return { plainText: currentPlainText, excerpt: null };
}
