import {
  TRAINING_PROGRESS_PREFIX,
  emptyTrainingProgress,
  trainingProgressId,
} from "./training";
import type { ModulePass, TrainingProgress } from "./training";

/**
 * Storage for training progress.
 *
 * One document per member of staff in the SYSTEM database, `training:<userId>`.
 * Why this rather than a log of events: the question to answer is "opened it or
 * not", not "the history of openings". A log would grow by one document per
 * press, travel with every sync, and give nothing beyond that.
 *
 * The document does replicate (`isReplicableDocId` filters out only seedstate,
 * applog, pin and _design) — otherwise the senior consultant could not see
 * progress from their own machine, which is the whole reason the log exists.
 */

async function getOrEmpty(systemDb: PouchDB.Database, userId: string): Promise<TrainingProgress> {
  try {
    return await systemDb.get<TrainingProgress>(trainingProgressId(userId));
  } catch (err) {
    if ((err as PouchDB.Core.Error).status === 404) return emptyTrainingProgress(userId);
    throw err;
  }
}

export async function loadTrainingProgress(
  systemDb: PouchDB.Database,
  userId: string,
): Promise<TrainingProgress> {
  return getOrEmpty(systemDb, userId);
}

/** Everyone's progress — for the lead's log. */
export async function listTrainingProgress(systemDb: PouchDB.Database): Promise<TrainingProgress[]> {
  const result = await systemDb.allDocs<TrainingProgress>({
    include_docs: true,
    startkey: TRAINING_PROGRESS_PREFIX,
    // "￰" is the conventional upper bound for a prefix range in PouchDB: it
    // sorts above any printable character, so the range takes every key that
    // starts with the prefix and nothing else.
    endkey: `${TRAINING_PROGRESS_PREFIX}￰`,
  } as PouchDB.Core.AllDocsWithinRangeOptions);
  return result.rows.map((row) => row.doc).filter((doc): doc is TrainingProgress & { _rev: string } => Boolean(doc));
}

async function save(systemDb: PouchDB.Database, next: TrainingProgress): Promise<TrainingProgress> {
  next.updatedAt = new Date().toISOString();
  const result = await systemDb.put(next as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);
  return { ...next, _rev: result.rev };
}

/**
 * Record that a material was opened.
 *
 * Idempotent and, more to the point, SILENT: opening the same material again
 * writes nothing. Otherwise every return to an article would create a revision,
 * and every sync an extra transfer. The mark is written once, and the date is
 * the first one.
 */
export async function recordMaterialView(
  systemDb: PouchDB.Database,
  userId: string,
  materialId: string,
): Promise<TrainingProgress> {
  const current = await getOrEmpty(systemDb, userId);
  // Training is not assigned — do not track progress at all. Otherwise everyone
  // who has simply been reading the handbook for three years would grow a
  // progress document, and one that travels with every sync at that. Once it is
  // assigned, counting starts.
  if (!current.assignedAt) return current;
  if (current.viewed[materialId]) return current;
  current.viewed = { ...current.viewed, [materialId]: new Date().toISOString() };
  return save(systemDb, current);
}

export async function markModulePassed(
  systemDb: PouchDB.Database,
  userId: string,
  moduleId: string,
  pass: Omit<ModulePass, "passedAt">,
): Promise<TrainingProgress> {
  const current = await getOrEmpty(systemDb, userId);
  // Retaking a block that is already closed does not rewrite the mark: the pass
  // date is when the person first passed, not the last time they looked in.
  if (current.modules[moduleId]) return current;
  current.modules = {
    ...current.modules,
    [moduleId]: { ...pass, passedAt: new Date().toISOString() },
  };
  return save(systemDb, current);
}

/**
 * Assign the training. Assigning again does not move the date — otherwise "when
 * it was assigned" would turn into "when somebody last pressed the button".
 */
export async function assignTraining(
  systemDb: PouchDB.Database,
  userId: string,
  assignedBy: string,
): Promise<TrainingProgress> {
  const current = await getOrEmpty(systemDb, userId);
  if (current.assignedAt) return current;
  current.assignedAt = new Date().toISOString();
  current.assignedBy = assignedBy;
  return save(systemDb, current);
}

/**
 * Withdraw the assignment. Progress and passed blocks STAY: withdrawing means
 * "not required for now", not "erase what this person did". Assign it again and
 * what was passed is still passed.
 */
export async function unassignTraining(systemDb: PouchDB.Database, userId: string): Promise<TrainingProgress> {
  const current = await getOrEmpty(systemDb, userId);
  if (!current.assignedAt) return current;
  delete current.assignedAt;
  delete current.assignedBy;
  return save(systemDb, current);
}
