import { describe, expect, it } from "vitest";
import { isVersionUnread } from "./changelog";
import type { ChangelogEntry } from "./changelog";

const ENTRIES: ChangelogEntry[] = [
  { version: "0.7.0", date: "2026-07-31", title: "Home page", items: ["a", "b"] },
  { version: "0.6.0", date: "2026-07-25", title: "Sidebar", items: ["c"] },
];

describe("isVersionUnread", () => {
  it("unread when no version has been marked yet (null)", () => {
    expect(isVersionUnread(ENTRIES, null)).toBe(true);
  });

  it("read when the latest entry's version is marked", () => {
    expect(isVersionUnread(ENTRIES, "0.7.0")).toBe(false);
  });

  it("unread when a version older than the latest is marked", () => {
    expect(isVersionUnread(ENTRIES, "0.6.0")).toBe(true);
  });

  it("an empty entry list does not count as unread", () => {
    expect(isVersionUnread([], null)).toBe(false);
  });
});
