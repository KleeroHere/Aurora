import { isTauriEnvironment } from "./filePortSelect";
import type { VideoPort } from "./videoPort";

export async function selectVideoPort(): Promise<VideoPort> {
  if (isTauriEnvironment()) {
    const { tauriVideoPort } = await import("./videoPortTauri");
    return tauriVideoPort;
  }
  const { browserVideoPort } = await import("./videoPortBrowser");
  return browserVideoPort;
}
