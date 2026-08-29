/**
 * Resolves a file from public/ against the app's base path. On a plain host
 * the base is "/", but on GitHub Pages the whole app lives under "/Aurora/",
 * and an absolute "/content/x.json" would escape it.
 */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}
