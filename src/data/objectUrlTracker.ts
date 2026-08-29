export interface ObjectUrlTracker {
  track(url: string): string;
  revokeAll(revoke?: (url: string) => void): void;
  readonly size: number;
}

export function createObjectUrlTracker(): ObjectUrlTracker {
  const urls = new Set<string>();
  return {
    track(url: string): string {
      urls.add(url);
      return url;
    },
    revokeAll(revoke: (url: string) => void = URL.revokeObjectURL): void {
      urls.forEach((url) => revoke(url));
      urls.clear();
    },
    get size() {
      return urls.size;
    },
  };
}
