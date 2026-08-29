import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import { createSystemDb } from "./db";
import { MAX_PINS, isPinned, listPins, pinMaterial, unpinMaterial } from "./pins";

let systemDb: PouchDB.Database;

beforeEach(() => {
  systemDb = createSystemDb(NodePouchDB, createNodeDbOptions());
});

afterEach(async () => {
  await systemDb.destroy().catch(() => undefined);
});

describe("pinMaterial/unpinMaterial/listPins", () => {
  it("pins a material, readable via listPins and isPinned", async () => {
    await pinMaterial(systemDb, "user:Alex", "article:a__1");
    expect(await isPinned(systemDb, "user:Alex", "article:a__1")).toBe(true);
    const pins = await listPins(systemDb, "user:Alex");
    expect(pins.map((p) => p.materialId)).toEqual(["article:a__1"]);
  });

  it("pinning the same material again creates no duplicate", async () => {
    await pinMaterial(systemDb, "user:Alex", "article:a__1");
    await pinMaterial(systemDb, "user:Alex", "article:a__1");
    expect((await listPins(systemDb, "user:Alex")).length).toBe(1);
  });

  it("unpinning a nonexistent pin is not an error", async () => {
    await expect(unpinMaterial(systemDb, "user:Alex", "article:nope")).resolves.toBeUndefined();
  });

  it(`does not allow pinning more than ${MAX_PINS}`, async () => {
    for (let i = 0; i < MAX_PINS; i++) {
      await pinMaterial(systemDb, "user:Alex", `article:a__${i}`);
    }
    await expect(pinMaterial(systemDb, "user:Alex", "article:a__overflow")).rejects.toThrow();
    expect((await listPins(systemDb, "user:Alex")).length).toBe(MAX_PINS);
  });

  it("different users' shelves do not overlap", async () => {
    await pinMaterial(systemDb, "user:Alex", "article:a__1");
    await pinMaterial(systemDb, "user:Sam", "article:a__2");
    expect((await listPins(systemDb, "user:Alex")).map((p) => p.materialId)).toEqual(["article:a__1"]);
    expect((await listPins(systemDb, "user:Sam")).map((p) => p.materialId)).toEqual(["article:a__2"]);
  });

  it("unpinning deletes the record", async () => {
    await pinMaterial(systemDb, "user:Alex", "article:a__1");
    await unpinMaterial(systemDb, "user:Alex", "article:a__1");
    expect(await isPinned(systemDb, "user:Alex", "article:a__1")).toBe(false);
    expect((await listPins(systemDb, "user:Alex")).length).toBe(0);
  });

  it("pin order increases and is preserved in listPins", async () => {
    await pinMaterial(systemDb, "user:Alex", "article:a__1");
    await pinMaterial(systemDb, "user:Alex", "article:a__2");
    const pins = await listPins(systemDb, "user:Alex");
    expect(pins[0].order).toBeLessThan(pins[1].order);
  });

  it(
    `FINDING: two PARALLEL pinMaterial calls for DIFFERENT materials at the ${MAX_PINS} threshold ` +
      "used to yield more than five pins (read-then-write without locking - both " +
      "read the existing list BEFORE the other managed to write)",
    async () => {
      for (let i = 0; i < MAX_PINS - 1; i++) {
        await pinMaterial(systemDb, "user:Alex", `article:a__${i}`);
      }
      const results = await Promise.allSettled([
        pinMaterial(systemDb, "user:Alex", "article:extra__1"),
        pinMaterial(systemDb, "user:Alex", "article:extra__2"),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      const pins = await listPins(systemDb, "user:Alex");
      expect(pins.length).toBe(MAX_PINS);
    },
  );

  it("parallel pinMaterial calls for the same material create no duplicate/409 conflict", async () => {
    await Promise.all([
      pinMaterial(systemDb, "user:Alex", "article:same"),
      pinMaterial(systemDb, "user:Alex", "article:same"),
    ]);
    const pins = await listPins(systemDb, "user:Alex");
    expect(pins.filter((p) => p.materialId === "article:same").length).toBe(1);
  });
});
