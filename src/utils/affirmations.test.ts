import { describe, expect, it } from "vitest";
import { pickAffirmationForDate } from "./affirmations";
import type { AffirmationEntry } from "./affirmations";

const ENTRIES: AffirmationEntry[] = [
  { day: "01-01", text: "Example 1" },
  { day: "02-29", text: "Leap-day example" },
  { day: "12-31", text: "Example 2" },
];

describe("pickAffirmationForDate", () => {
  it("finds an entry by MM-DD", () => {
    expect(pickAffirmationForDate(ENTRIES, new Date(2026, 0, 1))?.text).toBe("Example 1");
  });

  it("works for February 29", () => {
    expect(pickAffirmationForDate(ENTRIES, new Date(2024, 1, 29))?.text).toBe("Leap-day example");
  });

  it("null when there is no entry for today", () => {
    expect(pickAffirmationForDate(ENTRIES, new Date(2026, 5, 15))).toBeNull();
  });

  it("null on an empty array", () => {
    expect(pickAffirmationForDate([], new Date())).toBeNull();
  });
});
