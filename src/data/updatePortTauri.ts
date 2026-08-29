import { check } from "@tauri-apps/plugin-updater";
import type { Update } from "@tauri-apps/plugin-updater";
import type { UpdateCheckResult, UpdatePort } from "./updatePort";

let pending: Update | null = null;

export const tauriUpdatePort: UpdatePort = {
  async check(): Promise<UpdateCheckResult> {
    try {
      const update = await check();
      pending = update ?? null;
      if (!update) return { kind: "up-to-date" };
      return {
        kind: "available",
        update: {
          version: update.version,
          currentVersion: update.currentVersion,
          notes: update.body ?? "",
          date: update.date ?? null,
        },
      };
    } catch (err) {
      return { kind: "unavailable", reason: err instanceof Error ? err.message : String(err) };
    }
  },

  async install(onProgress): Promise<void> {
    if (!pending) {
      throw new Error('No update found. Click "Check for updates" first.');
    }
    let total: number | null = null;
    let downloaded = 0;
    await pending.downloadAndInstall((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? null;
        onProgress?.(null);
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        onProgress?.(total ? Math.min(1, downloaded / total) : null);
      } else if (event.event === "Finished") {
        onProgress?.(1);
      }
    });
  },
};
