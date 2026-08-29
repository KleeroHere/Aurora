/**
 * Human-readable text helpers: pluralization, durations, and an error
 * dictionary that turns technical failures into plain-language messages.
 *
 * The plural helper keeps a three-form signature (a leftover of the
 * Russian-first origin of the codebase); in English the middle form is
 * simply unused, and call sites pass ["item", "items", "items"].
 */

export function plural(count: number, forms: [one: string, few: string, many: string]): string {
  const n = Math.abs(Math.trunc(count));
  return n === 1 ? forms[0] : forms[2];
}

/** "386 documents", "1 document". */
export function pluralize(count: number, forms: [string, string, string]): string {
  return `${count} ${plural(count, forms)}`;
}

/** Frequently used words, so the forms are written once. */
export const WORDS = {
  document: ["document", "documents", "documents"] as [string, string, string],
  material: ["material", "materials", "materials"] as [string, string, string],
  file: ["file", "files", "files"] as [string, string, string],
  part: ["part", "parts", "parts"] as [string, string, string],
  record: ["record", "records", "records"] as [string, string, string],
  conflict: ["conflict", "conflicts", "conflicts"] as [string, string, string],
  account: ["account", "accounts", "accounts"] as [string, string, string],
  day: ["day", "days", "days"] as [string, string, string],
  month: ["month", "months", "months"] as [string, string, string],
};

/**
 * Video duration in player notation: "1:43", "12:05", "1:02:07".
 * Returns null for non-numbers so callers can simply hide the value.
 */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

interface ErrorRule {
  match: RegExp;
  text: string;
}

const RULES: ErrorRule[] = [
  {
    match: /Document update conflict|conflict/i,
    text: "Someone else saved this material at the same time. Reload the page and repeat your edit — nothing else was lost.",
  },
  {
    match: /missing|not_found|404/i,
    text: "The material was not found — it may have been deleted. Refresh the page and check the section list.",
  },
  {
    match: /QuotaExceeded|quota|disk|ENOSPC|no space/i,
    text: "The disk or storage quota is full. Free up some space and try again — nothing was saved.",
  },
  {
    match: /Failed to fetch|NetworkError|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i,
    text: "Could not reach the server. This is not fatal: the app works without it — try again later.",
  },
  {
    match: /Unauthorized|401|403|Forbidden/i,
    text: "The server rejected the name or password. Check them in the Sync panel.",
  },
  {
    match: /Invalid string length|out of memory|Array buffer allocation failed/i,
    text: "The operation needs more memory than is available. Close other applications and try again.",
  },
  {
    match: /aborted|AbortError/i,
    text: "The operation was cancelled. Nothing was saved — it is safe to retry.",
  },
];

/**
 * An error in plain language. The app's own errors are already written for
 * humans and pass through unchanged; raw technical messages are translated
 * by the dictionary above.
 */
export function humanError(error: unknown): string {
  const raw =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : String(error);

  const message = error instanceof Error ? error.message : raw;

  if (message.trim() === "") {
    return "Something went wrong, and the error carried no details. Try again; if it repeats, save a diagnostics file from the admin panel.";
  }

  for (const rule of RULES) {
    if (rule.match.test(raw)) return rule.text;
  }
  return message;
}
