import type { MaterialType } from "../data/types";

export function filterMaterialsByTypes<T extends { type: MaterialType }>(
  materials: T[],
  activeTypes: MaterialType[],
): T[] {
  if (activeTypes.length === 0) return materials;
  return materials.filter((material) => activeTypes.includes(material.type));
}
