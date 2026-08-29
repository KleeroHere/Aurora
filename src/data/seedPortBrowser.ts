import type { SeedPort } from "./seedPort";

export const browserSeedPort: SeedPort = {
  async hasSeedResource(): Promise<boolean> {
    return false;
  },

  async readSeedResource(name: string): Promise<Uint8Array> {
    throw new Error(
      `browserSeedPort.readSeedResource("${name}"): seed resources are unavailable outside Tauri — ` +
        "hasSeedResource() should have returned false before this call happened.",
    );
  },
};
