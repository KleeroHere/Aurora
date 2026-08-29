export interface OwnedUrlSlot {
  adopt(url: string): void;
  disown(): void;
  release(): void;
  readonly current: string | null;
}

const KEEP_ALIVE = 2;

export function createOwnedUrlSlot(revoke: (url: string) => void = URL.revokeObjectURL): OwnedUrlSlot {
  const owned: string[] = [];

  return {
    adopt(url: string): void {
      if (owned[owned.length - 1] === url) return;
      owned.push(url);
      while (owned.length > KEEP_ALIVE) {
        revoke(owned.shift() as string);
      }
    },
    disown(): void {
      owned.length = 0;
    },
    release(): void {
      while (owned.length > 0) {
        revoke(owned.shift() as string);
      }
    },
    get current() {
      return owned.length > 0 ? owned[owned.length - 1] : null;
    },
  };
}
