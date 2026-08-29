import type { Material, MaterialVideo } from "./types";

export interface VideoPort {
  resolveVideoUrl(relativePath: string): Promise<string>;
  videoExists(relativePath: string): Promise<boolean>;
}

export function normalizeVideo(value: MaterialVideo | string | null | undefined): MaterialVideo | null {
  if (!value) return null;
  if (typeof value === "string") {
    return null;
  }
  if (typeof value.path !== "string" || value.path.trim() === "") return null;
  return {
    path: value.path,
    durationSec: value.durationSec ?? null,
    width: value.width ?? null,
    height: value.height ?? null,
    posterFrameSec: value.posterFrameSec ?? null,
  };
}

export function videoOfMaterial(material: Material): MaterialVideo | null {
  if (material.type !== "article" && material.type !== "film") return null;
  return normalizeVideo(material.video);
}

export function isSafeVideoPath(path: string): boolean {
  if (!path || path.trim() !== path) return false;
  if (path.startsWith("/") || path.startsWith("\\")) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  const segments = path.split(/[\\/]/);
  return segments.length > 0 && segments.every((s) => s.length > 0 && s !== "." && s !== "..");
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}
