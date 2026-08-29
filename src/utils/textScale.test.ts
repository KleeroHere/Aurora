import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TEXT_SCALE,
  TEXT_SCALE_OPTIONS,
  applyTextScale,
  getTextScale,
  initTextScale,
  setTextScale,
} from "./textScale";
import { buildDocumentTitle } from "./documentTitle";

const store = new Map<string, string>();
const setProperty = vi.fn();

beforeEach(() => {
  store.clear();
  setProperty.mockClear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  });
  vi.stubGlobal("document", { documentElement: { style: { setProperty } } });
});

describe("text size", () => {
  it("regular by default, so behavior is exactly as before", () => {
    expect(getTextScale()).toBe(DEFAULT_TEXT_SCALE);
    expect(DEFAULT_TEXT_SCALE).toBe(1);
  });

  it("the choice survives a restart", () => {
    setTextScale(1.2);
    expect(getTextScale()).toBe(1.2);
  });

  it("applied to the document via a single variable - all typography is in rem", () => {
    setTextScale(1.3);
    expect(setProperty).toHaveBeenCalledWith("--text-scale", "1.3");
  });

  it("a value outside the scale is clamped to the bounds instead of breaking the layout", () => {
    setTextScale(9);
    expect(getTextScale()).toBe(1.3);
    setTextScale(0.2);
    expect(getTextScale()).toBe(1);
  });

  it("garbage in the storage does not block entering the app", () => {
    store.set("aurora.textScale", "not a number");
    expect(getTextScale()).toBe(DEFAULT_TEXT_SCALE);
  });

  it("startup applies the stored value before the first paint", () => {
    store.set("aurora.textScale", "1.1");
    initTextScale();
    expect(setProperty).toHaveBeenCalledWith("--text-scale", "1.1");
  });

  it("every offered step is within the allowed range, otherwise its button could not be selected", () => {
    for (const option of TEXT_SCALE_OPTIONS) {
      applyTextScale(option.value);
      setTextScale(option.value);
      expect(getTextScale()).toBe(option.value);
    }
  });
});

describe("window title", () => {
  it("material plus the app name - the window is recognizable in Alt-Tab", () => {
    expect(buildDocumentTitle("Newcomer questionnaire")).toBe("Newcomer questionnaire — Aurora");
  });

  it("nothing to show yet - just the app name, not \"undefined\"", () => {
    expect(buildDocumentTitle(undefined)).toBe("Aurora");
    expect(buildDocumentTitle(null)).toBe("Aurora");
    expect(buildDocumentTitle("   ")).toBe("Aurora");
  });
});
