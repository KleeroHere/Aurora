import { publicUrl } from "../utils/publicUrl";
import type { VideoPort } from "./videoPort";

function videoUrl(relativePath: string): string {
  return publicUrl(`videos/${relativePath.split(/[\\/]/).map(encodeURIComponent).join("/")}`);
}

export const browserVideoPort: VideoPort = {
  async resolveVideoUrl(relativePath: string): Promise<string> {
    const url = videoUrl(relativePath);
    const response = await fetch(url, { method: "HEAD" }).catch(() => null);
    if (!response || !response.ok) {
      throw new Error(`Video file not found: videos/${relativePath}`);
    }
    return url;
  },

  async videoExists(relativePath: string): Promise<boolean> {
    const response = await fetch(videoUrl(relativePath), { method: "HEAD" }).catch(() => null);
    return Boolean(response?.ok);
  },
};
