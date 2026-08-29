
const STORAGE_KEY = "aurora.textScale";

export interface TextScaleOption {
  value: number;
  label: string;
  hint: string;
}

export const TEXT_SCALE_OPTIONS: TextScaleOption[] = [
  { value: 1, label: "Regular", hint: "as before" },
  { value: 1.1, label: "Larger", hint: "+10 %" },
  { value: 1.2, label: "Large", hint: "+20 %" },
  { value: 1.3, label: "Very large", hint: "+30 %" },
];

export const DEFAULT_TEXT_SCALE = 1;

const MIN_SCALE = 1;
const MAX_SCALE = 1.3;

export function getTextScale(): number {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_TEXT_SCALE;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_TEXT_SCALE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, parsed));
}

export function applyTextScale(scale: number): void {
  document.documentElement.style.setProperty("--text-scale", String(scale));
}

export function setTextScale(scale: number): void {
  const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
  window.localStorage.setItem(STORAGE_KEY, String(clamped));
  applyTextScale(clamped);
}

export function initTextScale(): void {
  applyTextScale(getTextScale());
}
