import { describe, expect, it } from "vitest";
import { pickLatestByUpdatedAt } from "./conflictResolution";

describe("pickLatestByUpdatedAt", () => {
  it("picks the candidate with the latest updatedAt", () => {
    const a = { updatedAt: "2026-01-01T00:00:00.000Z", tag: "a" };
    const b = { updatedAt: "2026-06-01T00:00:00.000Z", tag: "b" };
    const c = { updatedAt: "2026-03-01T00:00:00.000Z", tag: "c" };
    expect(pickLatestByUpdatedAt([a, b, c])).toBe(b);
  });

  it("candidate order does not affect the result", () => {
    const a = { updatedAt: "2026-01-01T00:00:00.000Z" };
    const b = { updatedAt: "2026-06-01T00:00:00.000Z" };
    expect(pickLatestByUpdatedAt([b, a])).toBe(b);
  });

  it("on equal updatedAt the first in order wins (determinism)", () => {
    const a = { updatedAt: "2026-01-01T00:00:00.000Z", tag: "a" };
    const b = { updatedAt: "2026-01-01T00:00:00.000Z", tag: "b" };
    expect(pickLatestByUpdatedAt([a, b])).toBe(a);
  });

  it("throws on an empty list", () => {
    expect(() => pickLatestByUpdatedAt([])).toThrow();
  });
});
