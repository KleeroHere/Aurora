import { describe, expect, it } from "vitest";
import { coverThemeFor } from "./coverIllustration";

describe("coverThemeFor - cover theme from a title", () => {
  it("recognizes a theme across word forms, without a word-form dictionary", () => {
    expect(coverThemeFor("CRAVING")).toBe("sryv");
    expect(coverThemeFor("PHASES AND SIGNS OF RELAPSE")).toBe("sryv");
    expect(coverThemeFor("Gratitude notebook")).toBe("tetrad");
    expect(coverThemeFor("urge tension chart")).toBe("sryv");
  });

  it("a specific rule beats a general one - otherwise the theme is lost", () => {
    expect(coverThemeFor("Relapse prevention")).toBe("zaschita");
    expect(coverThemeFor("Relapse Prevention 2")).toBe("zaschita");
    expect(coverThemeFor("Kitchen cleaning")).toBe("kuhnya");
    expect(coverThemeFor("Cleaning")).toBe("uborka");
  });

  it("gathers things related by meaning, not by letters, into one theme", () => {
    const dnevnik = ["Diary review", "Daily pages", "Diary check"];
    for (const title of dnevnik) expect(coverThemeFor(title)).toBe("dnevnik");

    const svyaz = ["Calls", "Calls (for relatives)", "Chats", "Advertising phone"];
    for (const title of svyaz) expect(coverThemeFor(title)).toBe("pismo");
  });

  it("letter case does not get in the way", () => {
    expect(coverThemeFor("TRACKING CARD")).toBe("blank");
    expect(coverThemeFor("tracking card")).toBe("blank");
  });

  it("honestly returns null where there is nothing to latch onto", () => {
    for (const title of ["Trouble", "Triumph", "Serendipity", "Bric-a-brac"]) {
      expect(coverThemeFor(title)).toBeNull();
    }
  });

  it("the same title always yields the same theme", () => {
    const title = "Regular responsibilities";
    expect(coverThemeFor(title)).toBe(coverThemeFor(title));
    expect(coverThemeFor(title)).toBe("ruki");
  });
});
