import type { MaterialSummary } from "./types";

export type RepoChangeOp = "created" | "updated" | "deleted";

export interface RepoChangeEvent {
  op: RepoChangeOp;
  id: string;
  sectionId?: string;
  summary?: MaterialSummary;
  docType?: "material" | "section";
}

type Listener = (event: RepoChangeEvent) => void;

export function createChangeBus() {
  const listeners = new Set<Listener>();

  return {
    subscribe(fn: Listener): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit(event: RepoChangeEvent): void {
      for (const fn of listeners) fn(event);
    },
    clear(): void {
      listeners.clear();
    },
  };
}
