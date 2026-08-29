export function filterMaterialsByTags<T extends { tags: string[] }>(materials: T[], activeTags: string[]): T[] {
  if (activeTags.length === 0) return materials;
  return materials.filter((material) => activeTags.every((tag) => material.tags.includes(tag)));
}
