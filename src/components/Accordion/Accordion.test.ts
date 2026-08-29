import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "Accordion.css"), "utf-8");

function ruleBodyFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`Rule ${selector} not found in Accordion.css`);
  return match[1];
}

describe("Accordion.css: collapsed panel is not clickable", () => {
  it(".accordion__panel when collapsed: overflow hidden, pointer-events none, height 0fr", () => {
    const body = ruleBodyFor(".accordion__panel");
    expect(body).toMatch(/overflow:\s*hidden/);
    expect(body).toMatch(/pointer-events:\s*none/);
    expect(body).toMatch(/grid-template-rows:\s*0fr/);
  });

  it('.accordion__panel[data-open="true"]: clicks come back, height expands', () => {
    const body = ruleBodyFor('.accordion__panel[data-open="true"]');
    expect(body).toMatch(/pointer-events:\s*auto/);
    expect(body).toMatch(/grid-template-rows:\s*1fr/);
  });
});
