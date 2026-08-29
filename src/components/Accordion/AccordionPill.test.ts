import { describe, expect, it } from "vitest";
import { computePillRect, HIDDEN_PILL } from "./Accordion";
import type { RectLike } from "./Accordion";

describe("computePillRect", () => {
  const container: RectLike = { top: 100, left: 0, width: 280, height: 600 };

  it("position is the coordinate difference between the active node and the container", () => {
    const active: RectLike = { top: 150, left: 8, width: 264, height: 32 };
    expect(computePillRect(container, active)).toEqual({
      top: 50,
      left: 8,
      height: 32,
      scaleX: 264 / 280,
      visible: true,
    });
  });

  it("width is scaleX as a fraction of container width, not an absolute width", () => {
    const active: RectLike = { top: 150, left: 8, width: 140, height: 32 };
    expect(computePillRect(container, active).scaleX).toBeCloseTo(0.5, 5);
  });

  it("scrolling the list shifts container and active node equally — pill position stays the same", () => {
    const active: RectLike = { top: 150, left: 8, width: 264, height: 32 };
    const scrolled = 40;
    const containerScrolled: RectLike = { ...container, top: container.top - scrolled };
    const activeScrolled: RectLike = { ...active, top: active.top - scrolled };
    expect(computePillRect(containerScrolled, activeScrolled)).toEqual(computePillRect(container, active));
  });

  it("route change — a new active node recomputes the pill to its position instead of keeping the old one", () => {
    const before = computePillRect(container, { top: 130, left: 8, width: 100, height: 30 });
    const after = computePillRect(container, { top: 400, left: 20, width: 150, height: 30 });
    expect(after.top).not.toBe(before.top);
    expect(after).toEqual({ top: 300, left: 20, height: 30, scaleX: 150 / 280, visible: true });
  });

  it("zero container width (not measured yet) — scaleX 0, not NaN/Infinity", () => {
    const emptyContainer: RectLike = { top: 0, left: 0, width: 0, height: 0 };
    const active: RectLike = { top: 0, left: 0, width: 100, height: 30 };
    expect(computePillRect(emptyContainer, active).scaleX).toBe(0);
  });
});

describe("HIDDEN_PILL", () => {
  it("invisible and zero-sized — the 'no route with an active item' state (e.g. /admin, /settings)", () => {
    expect(HIDDEN_PILL.visible).toBe(false);
    expect(HIDDEN_PILL.scaleX).toBe(0);
  });
});
