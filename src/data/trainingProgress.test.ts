import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NodePouchDB, createNodeDbOptions } from "./pouchdbNode";
import {
  assignTraining,
  listTrainingProgress,
  loadTrainingProgress,
  markModulePassed,
  recordMaterialView,
  unassignTraining,
} from "./trainingProgress";

let counter = 0;
let db: PouchDB.Database;

beforeEach(() => {
  counter += 1;
  db = new NodePouchDB(`training-progress-${counter}`, createNodeDbOptions());
});

afterEach(async () => {
  await db.destroy().catch(() => undefined);
});

describe("progress appears only after training is assigned", () => {
  it("before assignment, openings are not recorded at all", async () => {
    await recordMaterialView(db, "user:1", "article:intake__the-intake-interview");
    const progress = await loadTrainingProgress(db, "user:1");
    expect(progress.viewed).toEqual({});
    expect(progress._rev).toBeUndefined();
    // And there is no document in the database either: somebody who has been
    // reading the handbook for three years should not grow anything that then
    // travels with a sync.
    expect(await listTrainingProgress(db)).toEqual([]);
  });

  it("after assignment, openings are recorded", async () => {
    await assignTraining(db, "user:1", "user:lead");
    await recordMaterialView(db, "user:1", "article:intake__the-intake-interview");

    const progress = await loadTrainingProgress(db, "user:1");
    expect(Object.keys(progress.viewed)).toEqual(["article:intake__the-intake-interview"]);
    expect(progress.assignedBy).toBe("user:lead");
  });
});

describe("opening marks", () => {
  const ID = "article:intake__the-intake-interview";

  beforeEach(async () => {
    await assignTraining(db, "user:1", "user:lead");
  });

  it("opening again writes no new revision — a sync would carry nothing", async () => {
    const first = await recordMaterialView(db, "user:1", ID);
    const second = await recordMaterialView(db, "user:1", ID);
    expect(second._rev).toBe(first._rev);
  });

  it("the opening date is the FIRST one; coming back does not move it", async () => {
    const first = await recordMaterialView(db, "user:1", ID);
    const at = first.viewed[ID];
    await recordMaterialView(db, "user:1", ID);
    const progress = await loadTrainingProgress(db, "user:1");
    expect(progress.viewed[ID]).toBe(at);
  });

  it("different materials accumulate in one document", async () => {
    await recordMaterialView(db, "user:1", "article:a");
    await recordMaterialView(db, "user:1", "article:b");
    const progress = await loadTrainingProgress(db, "user:1");
    expect(Object.keys(progress.viewed).sort()).toEqual(["article:a", "article:b"]);
  });
});

describe("block tests", () => {
  beforeEach(async () => {
    await assignTraining(db, "user:1", "user:lead");
  });

  it("the pass mark stores the result", async () => {
    await markModulePassed(db, "user:1", "crisis", { correct: 4, total: 4 });
    const progress = await loadTrainingProgress(db, "user:1");
    expect(progress.modules.crisis).toMatchObject({ correct: 4, total: 4 });
    expect(progress.modules.crisis.passedAt).toBeTruthy();
  });

  it("retaking a block already passed does not rewrite the pass date", async () => {
    const first = await markModulePassed(db, "user:1", "crisis", { correct: 4, total: 4 });
    const at = first.modules.crisis.passedAt;
    await markModulePassed(db, "user:1", "crisis", { correct: 2, total: 4 });
    const progress = await loadTrainingProgress(db, "user:1");
    expect(progress.modules.crisis.passedAt).toBe(at);
    expect(progress.modules.crisis.correct).toBe(4);
  });
});

describe("assigning and withdrawing", () => {
  it("assigning again does not move the date", async () => {
    const first = await assignTraining(db, "user:1", "user:lead");
    const at = first.assignedAt;
    await assignTraining(db, "user:1", "user:other");
    const progress = await loadTrainingProgress(db, "user:1");
    expect(progress.assignedAt).toBe(at);
    expect(progress.assignedBy).toBe("user:lead");
  });

  it("withdrawing an assignment does NOT erase what was passed", async () => {
    await assignTraining(db, "user:1", "user:lead");
    await recordMaterialView(db, "user:1", "article:a");
    await markModulePassed(db, "user:1", "crisis", { correct: 4, total: 4 });

    await unassignTraining(db, "user:1");
    const progress = await loadTrainingProgress(db, "user:1");
    expect(progress.assignedAt).toBeUndefined();
    expect(progress.modules.crisis).toBeTruthy();
    expect(progress.viewed["article:a"]).toBeTruthy();
  });
});

describe("the lead's log", () => {
  it("returns the progress of everyone assigned and nothing else", async () => {
    await assignTraining(db, "user:1", "user:lead");
    await assignTraining(db, "user:2", "user:lead");
    // Unrelated documents from the system database must not land in the log.
    await db.put({ _id: "settings:training", type: "settings", enabled: true });
    await db.put({ _id: "user:1", type: "user", login: "Alex" });

    const all = await listTrainingProgress(db);
    expect(all.map((p) => p.userId).sort()).toEqual(["user:1", "user:2"]);
  });
});
