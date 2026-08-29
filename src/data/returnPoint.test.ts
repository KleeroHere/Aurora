import { beforeEach, describe, expect, it } from "vitest";
import { forgetReturnPoint, rememberReturnPoint, takeReturnPoint } from "./returnPoint";

function createStorageStub(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  } as Storage;
}

describe("returnPoint", () => {
  let sessionStorage: Storage;

  beforeEach(() => {
    sessionStorage = createStorageStub();
    (globalThis as { window?: { sessionStorage: Storage } }).window = { sessionStorage };
  });

  it("a remembered material comes back for its own section", () => {
    rememberReturnPoint("otvetsvennosti", "article:otvetsvennosti__stirka");
    expect(takeReturnPoint("otvetsvennosti")).toBe("article:otvetsvennosti__stirka");
  });

  it("the point is single-use: a second read yields nothing", () => {
    rememberReturnPoint("otvetsvennosti", "article:otvetsvennosti__stirka");
    expect(takeReturnPoint("otvetsvennosti")).toBe("article:otvetsvennosti__stirka");
    expect(takeReturnPoint("otvetsvennosti")).toBeNull();
  });

  it("sections do not get mixed up with each other", () => {
    rememberReturnPoint("otvetsvennosti", "article:otvetsvennosti__stirka");
    rememberReturnPoint("meropriyatiya", "article:meropriyatiya__uborka-kuhni");

    expect(takeReturnPoint("meropriyatiya")).toBe("article:meropriyatiya__uborka-kuhni");
    expect(takeReturnPoint("otvetsvennosti")).toBe("article:otvetsvennosti__stirka");
  });

  it("a section where nothing was opened has no point", () => {
    expect(takeReturnPoint("instruktsii")).toBeNull();
  });

  it("opening another material overwrites the point instead of piling them up", () => {
    rememberReturnPoint("otvetsvennosti", "article:otvetsvennosti__stirka");
    rememberReturnPoint("otvetsvennosti", "article:otvetsvennosti__voda");
    expect(takeReturnPoint("otvetsvennosti")).toBe("article:otvetsvennosti__voda");
  });

  it("empty keys are not remembered: the material is not loaded yet — nothing to record", () => {
    rememberReturnPoint("", "article:x");
    rememberReturnPoint("otvetsvennosti", "");
    expect(takeReturnPoint("")).toBeNull();
    expect(takeReturnPoint("otvetsvennosti")).toBeNull();
  });

  it("forgetting works without reading first", () => {
    rememberReturnPoint("otvetsvennosti", "article:otvetsvennosti__stirka");
    forgetReturnPoint("otvetsvennosti");
    expect(takeReturnPoint("otvetsvennosti")).toBeNull();
  });

  it("foreign keys in the storage are left alone", () => {
    sessionStorage.setItem("postoronniy-klyuch", "do not touch");
    rememberReturnPoint("otvetsvennosti", "article:otvetsvennosti__stirka");
    takeReturnPoint("otvetsvennosti");
    expect(sessionStorage.getItem("postoronniy-klyuch")).toBe("do not touch");
  });
});
