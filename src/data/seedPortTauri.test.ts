import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

describe("tauriSeedPort.hasSeedResource", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("returns the Rust command's answer when IPC works", async () => {
    invoke.mockResolvedValue(true);
    const { tauriSeedPort } = await import("./seedPortTauri");
    await expect(tauriSeedPort.hasSeedResource()).resolves.toBe(true);
    expect(invoke).toHaveBeenCalledWith("has_seed_resource");
  });

  it("returns false, not an exception, when the binary lacks the command", async () => {
    invoke.mockRejectedValue(new Error("Command has_seed_resource not found"));
    const { tauriSeedPort } = await import("./seedPortTauri");
    await expect(tauriSeedPort.hasSeedResource()).resolves.toBe(false);
  });

  it("reading a resource, by contrast, does NOT swallow the error — otherwise seeding would silently pour in garbage", async () => {
    invoke.mockRejectedValue(new Error("resource missing"));
    const { tauriSeedPort } = await import("./seedPortTauri");
    await expect(tauriSeedPort.readSeedResource("bundle.manifest.json")).rejects.toThrow(
      "resource missing",
    );
  });
});
