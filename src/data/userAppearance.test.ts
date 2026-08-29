import { describe, expect, it } from "vitest";
import { resolveAppearance } from "./userAppearance";
import type { Appearance } from "./userAppearance";

const DEFAULTS: Appearance = { palette: "aurora", scheme: "light" };

describe("appearance of the signed-in user", () => {
  it("comes from their settings when present", () => {
    expect(resolveAppearance({ palette: "aurora", scheme: "dark" }, DEFAULTS)).toEqual({
      palette: "aurora",
      scheme: "dark",
    });
  });

  it("a user without settings gets the defaults, not someone else's", () => {
    expect(resolveAppearance(undefined, DEFAULTS)).toEqual(DEFAULTS);
    expect(resolveAppearance({}, DEFAULTS)).toEqual(DEFAULTS);
  });

  it("a missing half of the settings is filled in with the default", () => {
    expect(resolveAppearance({ palette: "aurora" }, DEFAULTS)).toEqual({
      palette: "aurora",
      scheme: "light",
    });
    expect(resolveAppearance({ scheme: "dark" }, DEFAULTS)).toEqual({
      palette: "aurora",
      scheme: "dark",
    });
  });

  it("the default scheme comes from outside — the system decides it, not the machine's cache", () => {
    expect(resolveAppearance(undefined, { palette: "aurora", scheme: "dark" }).scheme).toBe("dark");
  });
});
