
export interface AvailableUpdate {
  version: string;
  currentVersion: string;
  notes: string;
  date: string | null;
}

export type UpdateCheckResult =
  | { kind: "up-to-date" }
  | { kind: "available"; update: AvailableUpdate }
  | { kind: "unavailable"; reason: string };

export interface UpdatePort {
  check(): Promise<UpdateCheckResult>;
  install(onProgress?: (fraction: number | null) => void): Promise<void>;
}

export const noUpdatesPort: UpdatePort = {
  async check() {
    return { kind: "unavailable", reason: "The browser version does not need updates." };
  },
  async install() {
    throw new Error("The browser version does not need updates.");
  },
};
