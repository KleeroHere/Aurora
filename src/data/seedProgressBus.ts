import type { ImportProgress } from "./sync";

export type SeedProgressState =
  | { phase: "idle" }
  | { phase: "seeding"; progress: ImportProgress }
  | { phase: "done" }
  | { phase: "error"; message: string };

let current: SeedProgressState = { phase: "idle" };
const listeners = new Set<(state: SeedProgressState) => void>();

function emit(): void {
  for (const fn of listeners) fn(current);
}

export function getSeedProgress(): SeedProgressState {
  return current;
}

export function onSeedProgressChange(handler: (state: SeedProgressState) => void): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function publishSeedProgress(state: SeedProgressState): void {
  current = state;
  emit();
}

export function resetSeedProgressForTests(): void {
  current = { phase: "idle" };
  listeners.clear();
}
