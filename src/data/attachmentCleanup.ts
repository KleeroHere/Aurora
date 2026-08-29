import type { EditorJsBlock, EditorJsOutputData } from "./types";

export const PROTECTED_ATTACHMENT_KEYS: readonly string[] = ["original", "pdf", "cover"];

function collectBlockAttachmentKeys(blocks: readonly EditorJsBlock[]): Set<string> {
  const keys = new Set<string>();
  for (const block of blocks) {
    if (block.type === "image" || block.type === "attaches") {
      keys.add(block.data.file.key);
    }
  }
  return keys;
}

export function collectReferencedAttachmentKeys(
  ...bodies: readonly (EditorJsOutputData | undefined)[]
): Set<string> {
  const keys = new Set<string>();
  for (const body of bodies) {
    if (!body) continue;
    for (const key of collectBlockAttachmentKeys(body.blocks)) keys.add(key);
  }
  return keys;
}

export function computeOrphanedAttachmentKeys(
  existingKeys: readonly string[],
  referencedKeys: ReadonlySet<string>,
  protectedKeys: readonly string[] = PROTECTED_ATTACHMENT_KEYS,
): string[] {
  return existingKeys.filter((key) => !referencedKeys.has(key) && !protectedKeys.includes(key));
}
