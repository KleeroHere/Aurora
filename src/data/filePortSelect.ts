import { isTauri } from "@tauri-apps/api/core";
import type { FilePort } from "./filePort";

export function isTauriEnvironment(): boolean {
  return isTauri();
}

export async function selectFilePort(): Promise<FilePort> {
  if (isTauriEnvironment()) {
    const { tauriFilePort } = await import("./filePortTauri");
    return tauriFilePort;
  }
  const { browserFilePort } = await import("./filePortBrowser");
  return browserFilePort;
}
