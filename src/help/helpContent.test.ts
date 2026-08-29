import { describe, expect, it } from "vitest";
import { HELP_TOPICS, HELP_TOUR, HELP_BY_ANCHOR, CHROME_ANCHORS, isChromeTopic } from "./helpContent";

const ANCHOR_RE = /data-help="([^"]+)"/g;

const sources = import.meta.glob("../**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const markedInCode = new Map<string, string[]>();
for (const [file, text] of Object.entries(sources)) {
  for (const match of text.matchAll(ANCHOR_RE)) {
    const anchor = match[1];
    if (anchor.includes("${")) continue;
    markedInCode.set(anchor, [...(markedInCode.get(anchor) ?? []), file]);
  }
}

describe("built-in help", () => {
  it("every help topic has a marked element in the code", () => {
    const orphans = HELP_TOPICS.filter((topic) => !markedInCode.has(topic.anchor)).map((t) => t.anchor);
    expect(orphans, `topics without an element: ${orphans.join(", ")}`).toEqual([]);
  });

  it("every marked element has a help text", () => {
    const unexplained = [...markedInCode.keys()].filter((anchor) => !HELP_BY_ANCHOR.has(anchor));
    expect(unexplained, `elements without a text: ${unexplained.join(", ")}`).toEqual([]);
  });

  it("topic keys are unique", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const topic of HELP_TOPICS) {
      if (seen.has(topic.anchor)) duplicates.push(topic.anchor);
      seen.add(topic.anchor);
    }
    expect(duplicates).toEqual([]);
  });

  it("tour steps point at existing elements", () => {
    const broken = HELP_TOUR.filter((step) => step.anchor !== null && !markedInCode.has(step.anchor)).map(
      (step) => step.anchor,
    );
    expect(broken, `tour steps without an element: ${broken.join(", ")}`).toEqual([]);
  });

  it("the tour opens with a greeting not tied to an element", () => {
    expect(HELP_TOUR[0].anchor).toBeNull();
  });

  it("texts are written without technical jargon", () => {
    const banned = /\b(interface|component|entit(y|ies)|render|commit|deploy|widget|tooltip)\b/i;
    const guilty = HELP_TOPICS.filter((t) => banned.test(t.body) || banned.test(t.title)).map((t) => t.anchor);
    expect(guilty, `technical jargon in texts: ${guilty.join(", ")}`).toEqual([]);
  });

  it("the chrome anchor list matches the texts", () => {
    const missing = [...CHROME_ANCHORS].filter((anchor) => !HELP_BY_ANCHOR.has(anchor));
    expect(missing, `chrome list contains nonexistent keys: ${missing.join(", ")}`).toEqual([]);
  });

  it("every screen has topics of its own, not just chrome ones", () => {
    const screens = [...new Set(HELP_TOPICS.map((t) => t.screen))].filter((s) => s !== "global");
    const bare = screens.filter(
      (screen) => !HELP_TOPICS.some((t) => t.screen === screen && !isChromeTopic(t.anchor)),
    );
    expect(bare, `screens without their own topics: ${bare.join(", ")}`).toEqual([]);
  });

  it("chrome topics are marked only among global ones", () => {
    const wrong = HELP_TOPICS.filter((t) => isChromeTopic(t.anchor) && t.screen !== "global").map((t) => t.anchor);
    expect(wrong, `marked as chrome but tied to a screen: ${wrong.join(", ")}`).toEqual([]);
  });

  it("every topic explains something instead of merely naming it", () => {
    const tooShort = HELP_TOPICS.filter((t) => t.body.trim().length < 60).map((t) => t.anchor);
    expect(tooShort, `explanations that are too short: ${tooShort.join(", ")}`).toEqual([]);
  });
});
