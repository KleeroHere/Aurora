import type { MouseEvent } from "react";

const RIPPLE_DURATION_MS = 500;

export function useRipple(): (event: MouseEvent<HTMLElement>) => void {
  return function trigger(event: MouseEvent<HTMLElement>) {
    const el = event.currentTarget;
    el.classList.remove("btn-ripple--active");
    void el.offsetWidth; // force a reflow - otherwise a repeat click before the animation ends will not restart it
    el.classList.add("btn-ripple--active");
    window.setTimeout(() => el.classList.remove("btn-ripple--active"), RIPPLE_DURATION_MS);
  };
}
