
export const INTERNAL_LINK_PREFIX = "/material/";

export function buildInternalLinkHref(materialId: string): string {
  return `${INTERNAL_LINK_PREFIX}${encodeURIComponent(materialId)}`;
}

export function isInternalMaterialLink(href: string | null | undefined): boolean {
  if (!href) return false;
  return href.startsWith(INTERNAL_LINK_PREFIX);
}

export function extractMaterialIdFromHref(href: string | null | undefined): string | null {
  if (!isInternalMaterialLink(href)) return null;
  const encoded = (href as string).slice(INTERNAL_LINK_PREFIX.length).split(/[?#]/)[0];
  if (!encoded) return null;
  try {
    const decoded = decodeURIComponent(encoded);
    return decoded || null;
  } catch {
    return null;
  }
}
