import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONNECTED_TOOLS, EDITOR_I18N, untranslatedTools } from "./editorI18n";

const EDITOR_SOURCE = readFileSync(
  new URL("./ArticleEditor.tsx", import.meta.url) as unknown as string,
  "utf-8",
) as unknown as string;

function toolsDeclaredInEditor(): string[] {
  const start = EDITOR_SOURCE.indexOf("        tools: {");
  expect(start, "tools object not found in ArticleEditor.tsx — the test lost its source of truth").toBeGreaterThan(0);
  const tail = EDITOR_SOURCE.slice(start);
  const keys: string[] = [];
  for (const match of tail.matchAll(/^ {10}(\w+):\s*\{/gm)) keys.push(match[1]);
  return keys;
}

describe("editor dictionary", () => {
  it("is wired into the editor itself, not just sitting next to it", () => {
    expect(EDITOR_SOURCE).toContain("i18n: EDITOR_I18N");
  });

  it("the dictionary's list of connected tools matches the real one", () => {
    const declared = toolsDeclaredInEditor().sort();
    const known = [...CONNECTED_TOOLS].filter((t) => t !== "paragraph").sort();
    expect(declared).toEqual(known);
  });

  it("every connected tool has its own dictionary section", () => {
    expect(untranslatedTools()).toEqual([]);
  });

  it("a new tool without a dictionary entry gets caught", () => {
    expect(untranslatedTools([...CONNECTED_TOOLS, "checklist"])).toEqual(["checklist"]);
  });

  it("the core labels the task was opened for are covered", () => {
    const { ui, blockTunes } = EDITOR_I18N.messages;
    expect(ui.toolbar.toolbox.Add).toBe("Add");
    expect(ui.inlineToolbar.converter["Convert to"]).toBe("Convert to");
    expect(blockTunes.moveUp["Move up"]).toBe("Move up");
    expect(blockTunes.moveDown["Move down"]).toBe("Move down");
    expect(blockTunes.delete.Delete).toBe("Delete");
  });

  it("namespaces are not mixed up — otherwise the dictionary silently does not apply", () => {
    const messages = EDITOR_I18N.messages as Record<string, unknown>;
    expect(Object.keys(messages).sort()).toEqual(["blockTunes", "toolNames", "tools", "ui"]);
  });
});
