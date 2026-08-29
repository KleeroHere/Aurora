import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { VideoPort } from "./videoPort";

export const tauriVideoPort: VideoPort = {
  async resolveVideoUrl(relativePath: string): Promise<string> {
    const absolute = await invoke<string>("resolve_video_path", { relativePath });
    return convertFileSrc(absolute);
  },

  async videoExists(relativePath: string): Promise<boolean> {
    try {
      await invoke<string>("resolve_video_path", { relativePath });
      return true;
    } catch {
      return false;
    }
  },
};
