
export interface HasUpdatedAt {
  updatedAt: string;
}

export function pickLatestByUpdatedAt<T extends HasUpdatedAt>(candidates: T[]): T {
  if (candidates.length === 0) {
    throw new Error("pickLatestByUpdatedAt: empty candidate list");
  }
  return candidates.reduce((latest, candidate) =>
    new Date(candidate.updatedAt).getTime() > new Date(latest.updatedAt).getTime() ? candidate : latest,
  );
}
