import { describe, expect, it } from "vitest";
import { slugify, transliterate } from "./slug";

describe("transliterate: golden table of the whole Cyrillic alphabet (character by character)", () => {
  const alphabet: Array<[string, string]> = [
    ["а", "a"], ["б", "b"], ["в", "v"], ["г", "g"], ["д", "d"],
    ["е", "e"], ["ё", "e"], ["ж", "zh"], ["з", "z"], ["и", "i"],
    ["й", "y"], ["к", "k"], ["л", "l"], ["м", "m"], ["н", "n"],
    ["о", "o"], ["п", "p"], ["р", "r"], ["с", "s"], ["т", "t"],
    ["у", "u"], ["ф", "f"], ["х", "h"], ["ц", "ts"], ["ч", "ch"],
    ["ш", "sh"], ["щ", "sch"], ["ъ", ""], ["ы", "y"], ["ь", ""],
    ["э", "e"], ["ю", "yu"], ["я", "ya"],
  ];

  it.each(alphabet)("'%s' → '%s'", (letter, expected) => {
    expect(transliterate(letter)).toBe(expected);
  });

  it("uppercase transliterates the same as lowercase (transliterate lowercases the input)", () => {
    expect(transliterate("Ц")).toBe("ts");
    expect(transliterate("Щ")).toBe("sch");
    expect(transliterate("Ё")).toBe("e");
  });
});

describe("transliterate: golden pairs on words (lossy letters in context, not in isolation)", () => {
  const words: Array<[string, string]> = [
    ["цирк", "tsirk"],
    ["щука", "schuka"],
    ["ёлка", "elka"],
    ["объект", "obekt"], // hard sign maps to "" — the letter drops, the word gets one character shorter
    ["мальчик", "malchik"], // same for the soft sign
    ["съёмка", "semka"], // hard sign next to yo — both rules at once
    ["читать", "chitat"],
    ["ежедневник", "ezhednevnik"],
  ];

  it.each(words)("'%s' → '%s'", (word, expected) => {
    expect(transliterate(word)).toBe(expected);
  });
});

describe("slugify: golden input-to-slug pairs (full pipeline of section 2.1)", () => {
  const pairs: Array<[string, string]> = [
    ["Щ – особая буква", "sch-osobaya-bukva"],
    ["Объектив ц/ч/ш/щ", "obektiv-ts-ch-sh-sch"],
    ["Ёж и ёлка", "ezh-i-elka"],
  ];

  it.each(pairs)("'%s' → '%s'", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("slugify: lossy collision (section 2.2) — different sources, one slug", () => {
  const collisionGroups: Array<[string, string[]]> = [
    ["shag-1", ["Шаг 1", "Шаг-1", "Шаг   1", "шаг 1"]],
    ["obekt-1", ["Объект 1", "Объект-1"]],
  ];

  it.each(collisionGroups)("group with slug '%s' — all variants collapse into one", (expectedSlug, variants) => {
    for (const variant of variants) {
      expect(slugify(variant)).toBe(expectedSlug);
    }
  });
});
