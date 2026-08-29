
const APP_LOCALE = "en-US";

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString(APP_LOCALE, { day: "numeric", month: "long", year: "numeric" });
}
