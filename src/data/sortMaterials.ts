export function naturalCompare(a: string, b: string): number {
  if (a === b) return 0;

  const aParts = a.split(/(\d+)/);
  const bParts = b.split(/(\d+)/);
  const minLength = Math.min(aParts.length, bParts.length);

  for (let i = 0; i < minLength; i++) {
    const aPart = aParts[i];
    const bPart = bParts[i];

    if (aPart === bPart) continue;

    const aIsNum = /^\d+$/.test(aPart);
    const bIsNum = /^\d+$/.test(bPart);

    if (aIsNum && bIsNum) {
      const aNum = BigInt(aPart);
      const bNum = BigInt(bPart);
      if (aNum !== bNum) return aNum < bNum ? -1 : 1;
    } else {
      const cmp = aPart.toLowerCase().localeCompare(bPart.toLowerCase(), 'ru');
      if (cmp !== 0) return cmp;
    }
  }

  return aParts.length - bParts.length;
}

export function compareMaterials(
  a: { title: string; order?: number | null },
  b: { title: string; order?: number | null },
): number {
  const aHas = a.order !== undefined && a.order !== null;
  const bHas = b.order !== undefined && b.order !== null;

  if (aHas && bHas) {
    if (a.order !== b.order) return (a.order as number) - (b.order as number);
    return naturalCompare(a.title, b.title);
  }
  if (aHas) return -1;
  if (bHas) return 1;

  return naturalCompare(a.title, b.title);
}
