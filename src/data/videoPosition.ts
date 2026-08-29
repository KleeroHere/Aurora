
const PREFIX = "aurora.video.position.";

export function isEffectivelyFinished(positionSec: number, durationSec: number): boolean {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return false;
  const left = durationSec - positionSec;
  return left <= 15 || left / durationSec <= 0.02;
}

export function shouldRemember(positionSec: number, durationSec: number): boolean {
  if (!Number.isFinite(positionSec) || positionSec < 5) return false;
  return !isEffectivelyFinished(positionSec, durationSec);
}

export function readVideoPosition(materialId: string): number | null {
  try {
    const raw = localStorage.getItem(PREFIX + materialId);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeVideoPosition(materialId: string, positionSec: number, durationSec: number): void {
  try {
    if (shouldRemember(positionSec, durationSec)) {
      localStorage.setItem(PREFIX + materialId, String(Math.floor(positionSec)));
    } else {
      localStorage.removeItem(PREFIX + materialId);
    }
  } catch {
  }
}

export function clearVideoPosition(materialId: string): void {
  try {
    localStorage.removeItem(PREFIX + materialId);
  } catch {
  }
}
