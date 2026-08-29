export interface SeedPort {
  hasSeedResource(): Promise<boolean>;

  readSeedResource(name: string): Promise<Uint8Array>;
}
