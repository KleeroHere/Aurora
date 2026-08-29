import { invoke } from "@tauri-apps/api/core";
import type { SeedPort } from "./seedPort";

export const tauriSeedPort: SeedPort = {
  async hasSeedResource(): Promise<boolean> {
    try {
      return await invoke<boolean>("has_seed_resource");
    } catch (err) {
      console.warn(
        "has_seed_resource is unavailable (outdated Tauri binary?) — seeding from the bundle skipped:",
        err,
      );
      return false;
    }
  },

  async readSeedResource(name: string): Promise<Uint8Array> {
    const buffer = await invoke<ArrayBuffer>("read_seed_resource", { name });
    return new Uint8Array(buffer);
  },
};
