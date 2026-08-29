import { BrowserPouchDB } from "./pouchdbBrowser";
import { createContentDb, createSystemDb } from "./db";
import { initRepository, runUpkeep } from "./repository";
import { selectFilePort } from "./filePortSelect";
import { selectSeedPort } from "./seedPortSelect";

import { seedFromBundleIfNeeded } from "./seedBundle";
import { installDevBridge } from "./devBridge";

export async function bootstrapRepository(): Promise<void> {
  const contentDb = createContentDb(BrowserPouchDB);
  const systemDb = createSystemDb(BrowserPouchDB);
  const filePort = await selectFilePort();
  const seedPort = await selectSeedPort();
  const hasBundledSeed = await seedPort.hasSeedResource();

  // Lite build: there is no bundled seed, so the demo handbook is seeded on
  // first run in BOTH the browser and the desktop app - an empty demo helps
  // nobody. A bundled seed, when present, still takes priority.
  const seedDemoContent = !hasBundledSeed;

  await initRepository({ contentDb, systemDb, filePort, seed: seedDemoContent });

  if (hasBundledSeed) {
    await seedFromBundleIfNeeded(contentDb, systemDb, filePort, seedPort);
  }

  installDevBridge({ contentDb, systemDb, filePort });

  //
  void runUpkeep().catch(() => undefined);
}
