
const PREFIX = "aurora:return-point:";

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberReturnPoint(sectionId: string, materialId: string): void {
  if (!sectionId || !materialId) return;
  try {
    storage()?.setItem(PREFIX + sectionId, materialId);
  } catch {
  }
}

export function takeReturnPoint(sectionId: string): string | null {
  if (!sectionId) return null;
  try {
    const store = storage();
    if (!store) return null;
    const value = store.getItem(PREFIX + sectionId);
    if (value) store.removeItem(PREFIX + sectionId);
    return value;
  } catch {
    return null;
  }
}

export function forgetReturnPoint(sectionId: string): void {
  try {
    storage()?.removeItem(PREFIX + sectionId);
  } catch {
  }
}
