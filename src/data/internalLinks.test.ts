import { describe, expect, it } from "vitest";
import {
  buildInternalLinkHref,
  extractMaterialIdFromHref,
  isInternalMaterialLink,
} from "./internalLinks";

describe("isInternalMaterialLink", () => {
  it("recognizes our /material/<id> format", () => {
    expect(isInternalMaterialLink("/material/article%3Alekcii__abc")).toBe(true);
  });

  it("rejects absolute external links", () => {
    expect(isInternalMaterialLink("https://example.com/material/x")).toBe(false);
    expect(isInternalMaterialLink("http://example.com")).toBe(false);
  });

  it("rejects protocol-relative links (//host/...)", () => {
    expect(isInternalMaterialLink("//example.com/material/x")).toBe(false);
  });

  it("rejects mailto and other schemes", () => {
    expect(isInternalMaterialLink("mailto:test@example.com")).toBe(false);
  });

  it("rejects relative links of other shapes", () => {
    expect(isInternalMaterialLink("/section/x")).toBe(false);
    expect(isInternalMaterialLink("material/x")).toBe(false);
  });

  it("rejects null/undefined/empty string", () => {
    expect(isInternalMaterialLink(null)).toBe(false);
    expect(isInternalMaterialLink(undefined)).toBe(false);
    expect(isInternalMaterialLink("")).toBe(false);
  });
});

describe("extractMaterialIdFromHref", () => {
  it("resolves the href into a material id (decodes URL encoding)", () => {
    const href = buildInternalLinkHref("article:lekcii__profilaktika-sryva");
    expect(extractMaterialIdFromHref(href)).toBe("article:lekcii__profilaktika-sryva");
  });

  it("returns null for an external link", () => {
    expect(extractMaterialIdFromHref("https://example.com/material/x")).toBeNull();
  });

  it("returns null for an empty tail", () => {
    expect(extractMaterialIdFromHref("/material/")).toBeNull();
  });

  it("returns null for invalid URL encoding instead of throwing", () => {
    expect(extractMaterialIdFromHref("/material/%E0%A4%A")).toBeNull();
  });

  it("drops the query/hash tail when resolving", () => {
    expect(extractMaterialIdFromHref("/material/abc?ref=sidebar")).toBe("abc");
    expect(extractMaterialIdFromHref("/material/abc#section")).toBe("abc");
  });
});

describe("buildInternalLinkHref", () => {
  it("URL-encodes the id (colon/double underscore from the material _id)", () => {
    expect(buildInternalLinkHref("article:lekcii__a")).toBe("/material/article%3Alekcii__a");
  });

  it("a built href is recognized as internal and resolves back", () => {
    const id = "film:filmy__28-dney";
    const href = buildInternalLinkHref(id);
    expect(isInternalMaterialLink(href)).toBe(true);
    expect(extractMaterialIdFromHref(href)).toBe(id);
  });
});
