import type { SeedPort } from "./seedPort";
import { isTauriEnvironment } from "./filePortSelect";

export async function selectSeedPort(): Promise<SeedPort> {
  if (isTauriEnvironment()) {
    const { tauriSeedPort } = await import("./seedPortTauri");
    return tauriSeedPort;
  }
  const { browserSeedPort } = await import("./seedPortBrowser");
  return browserSeedPort;
}
