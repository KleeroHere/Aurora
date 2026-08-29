import { afterEach, describe, expect, it } from "vitest";
import { browserFilePort } from "./filePortBrowser";
import { isTauriEnvironment, selectFilePort } from "./filePortSelect";

declare global {
  // eslint-disable-next-line no-var
  var isTauri: boolean | undefined;
}

describe("isTauriEnvironment", () => {
  afterEach(() => {
    delete globalThis.isTauri;
  });

  it("false outside Tauri (plain browser/test run)", () => {
    expect(isTauriEnvironment()).toBe(false);
  });

  it("true inside the Tauri webview (globalThis.isTauri === true)", () => {
    globalThis.isTauri = true;
    expect(isTauriEnvironment()).toBe(true);
  });
});

describe("selectFilePort", () => {
  afterEach(() => {
    delete globalThis.isTauri;
  });

  it("returns browserFilePort outside Tauri", async () => {
    const port = await selectFilePort();
    expect(port).toBe(browserFilePort);
  });

  it("returns tauriFilePort in the Tauri environment (not browserFilePort)", async () => {
    globalThis.isTauri = true;
    const { tauriFilePort } = await import("./filePortTauri");
    const port = await selectFilePort();
    expect(port).toBe(tauriFilePort);
    expect(port).not.toBe(browserFilePort);
  });
});
