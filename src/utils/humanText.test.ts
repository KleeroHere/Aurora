import { describe, expect, it } from "vitest";
import { WORDS, humanError, plural, pluralize } from "./humanText";

describe("pluralization", () => {
  it("singular for one, plural otherwise", () => {
    expect(pluralize(1, WORDS.document)).toBe("1 document");
    expect(pluralize(2, WORDS.document)).toBe("2 documents");
    expect(pluralize(5, WORDS.document)).toBe("5 documents");
  });

  it("teens and larger counts stay plural", () => {
    for (const n of [11, 12, 13, 14, 111, 112, 113, 114]) {
      expect(plural(n, WORDS.document), `${n}`).toBe("documents");
    }
    expect(pluralize(21, WORDS.document)).toBe("21 documents");
    expect(pluralize(101, WORDS.document)).toBe("101 documents");
  });

  it("zero is plural", () => {
    expect(pluralize(0, WORDS.document)).toBe("0 documents");
  });

  it("a realistic count reads naturally", () => {
    expect(pluralize(386, WORDS.document)).toBe("386 documents");
  });

  it("other words follow the same rule", () => {
    expect(pluralize(1, WORDS.part)).toBe("1 part");
    expect(pluralize(3, WORDS.part)).toBe("3 parts");
    expect(pluralize(9, WORDS.part)).toBe("9 parts");
    expect(pluralize(1, WORDS.record)).toBe("1 record");
    expect(pluralize(2, WORDS.record)).toBe("2 records");
    expect(pluralize(5, WORDS.record)).toBe("5 records");
  });
});

describe("human-readable errors", () => {
  it("an edit conflict is explained with a suggested next step", () => {
    const text = humanError(new Error("Document update conflict"));
    expect(text).toContain("Reload the page");
  });

  it("a conflict is also recognized by the PouchDB error name", () => {
    const err = Object.assign(new Error("conflict"), { name: "conflict", status: 409 });
    expect(humanError(err)).toContain("at the same time");
  });

  it("a vanished material, exhausted storage, a dropped connection - each with its own explanation", () => {
    expect(humanError(new Error("missing"))).toContain("not found");
    expect(humanError(new Error("QuotaExceededError"))).toContain("space");
    expect(humanError(new TypeError("Failed to fetch"))).toContain("server");
  });

  it("the app's own plain-language errors pass through as is", () => {
    const own = "The backup file could not be read. This is not a breakage: the app keeps working without it.";
    expect(humanError(new Error(own))).toBe(own);
  });

  it("an unrecognized technical error passes through unchanged", () => {
    const message = "EPERM: operation not permitted, rename";
    expect(humanError(new Error(message))).toBe(message);
  });

  it("an empty error still says something", () => {
    expect(humanError(new Error(""))).toContain("Try again");
    expect(humanError(undefined)).toBeTruthy();
  });

  it("every known technical error is replaced by a friendly text, not echoed raw", () => {
    const cases = [
      new Error("Document update conflict"),
      new Error("missing"),
      new Error("QuotaExceededError"),
      new TypeError("Failed to fetch"),
      new Error("401 Unauthorized"),
      new Error("Invalid string length"),
      new Error("AbortError"),
      new Error(""),
    ];
    for (const error of cases) {
      const text = humanError(error);
      expect(text, `"${error.message}" translated into "${text}"`).not.toBe(error.message);
    }
  });
});

import { formatDuration } from "./humanText";

describe("formatDuration - running time like in a player", () => {
  it("minutes and seconds", () => {
    expect(formatDuration(103.1)).toBe("1:43");
    expect(formatDuration(725)).toBe("12:05");
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(59.6)).toBe("1:00");
  });

  it("hours appear only when present", () => {
    expect(formatDuration(3727)).toBe("1:02:07");
  });

  it("garbage does not turn into NaN:NaN", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(-3)).toBeNull();
    expect(formatDuration(Number.NaN)).toBeNull();
  });
});
