export function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && typeof document.startViewTransition === "function";
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function materialTransitionName(materialId: string): string {
  return `material-${materialId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
