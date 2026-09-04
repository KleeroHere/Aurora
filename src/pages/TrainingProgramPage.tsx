import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentUser } from "../context/CurrentUserContext";
import {
  getAllTrainingProgress,
  getMaterialsBySection,
  getTrainingProgress,
  markTrainingModulePassed,
} from "../data/repository";
import { TRAINING_MODULES, isProgramComplete, moduleHasTest, moduleStatus } from "../data/training";
import type { ModuleStatus, TrainingProgress, TrainingResult } from "../data/training";
import type { MaterialSummary } from "../data/types";
import TrainingQuiz from "../components/TrainingCourse/TrainingQuiz";
import { humanError } from "../utils/humanText";
import "./TrainingProgramPage.css";

/**
 * The training programme — the blocks of the induction checklist.
 *
 * What is honest here and what is not is worth knowing straight away. Progress
 * counts material OPENINGS, not reading: the second cannot be guaranteed, and
 * the progress bar here is bookkeeping and motivation, not proof of knowledge.
 * The proof is the test, and it unlocks only once every material in the block
 * has been opened.
 *
 * A passed block does NOT disappear from the list. The temptation is there —
 * a shorter list — but a month later somebody is looking for where they read
 * about a resident leaving, and the section is gone from their training. Only
 * the badge in the header disappears, and only when every block is closed.
 */

interface ModuleMaterials {
  moduleId: string;
  materials: MaterialSummary[];
}

function percent(ratio: number): number {
  return Math.round(ratio * 100);
}

export default function TrainingProgramPage() {
  const { currentUser } = useCurrentUser();
  const [materials, setMaterials] = useState<ModuleMaterials[] | null>(null);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      TRAINING_MODULES.map(async (m) => {
        const lists = await Promise.all(m.sectionIds.map((id) => getMaterialsBySection(id)));
        // A block can be assembled from several sections. The same material
        // cannot live in two of them, but guarding against a duplicate is cheap
        // and double counting would break the progress bar.
        const seen = new Set<string>();
        return lists.flat().filter((x) => !seen.has(x._id) && seen.add(x._id));
      }),
    )
      .then((lists) => {
        if (cancelled) return;
        setMaterials(TRAINING_MODULES.map((m, i) => ({ moduleId: m.id, materials: lists[i] })));
      })
      .catch((err) => !cancelled && setError(humanError(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadProgress = useCallback(() => {
    if (!currentUser) return;
    getTrainingProgress(currentUser._id)
      .then(setProgress)
      .catch((err) => setError(humanError(err)));
  }, [currentUser]);

  useEffect(reloadProgress, [reloadProgress]);

  const statuses: ModuleStatus[] = useMemo(() => {
    if (!materials || !progress) return [];
    return TRAINING_MODULES.map((m) => {
      const ids = materials.find((x) => x.moduleId === m.id)?.materials.map((x) => x._id) ?? [];
      return moduleStatus(progress, m, ids);
    });
  }, [materials, progress]);

  /**
   * A block without a test closes by reading — but the fact still has to be
   * WRITTEN DOWN rather than recomputed every time. Otherwise the header badge
   * and the lead's log, neither of which has material lists to hand, could not
   * learn that a block was closed without walking every section of the database
   * on every render.
   */
  useEffect(() => {
    if (!currentUser || !progress || statuses.length === 0) return;
    const toRecord = statuses.filter(
      (s) => !moduleHasTest(s.module) && s.total > 0 && s.testUnlocked && !progress.modules[s.module.id],
    );
    if (toRecord.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const s of toRecord) {
        await markTrainingModulePassed(currentUser._id, s.module.id, { correct: 0, total: 0 }).catch(
          () => undefined,
        );
      }
      if (!cancelled) reloadProgress();
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, progress, statuses, reloadProgress]);

  const titleOf = useCallback(
    (materialId: string) => {
      for (const group of materials ?? []) {
        const found = group.materials.find((m) => m._id === materialId);
        if (found) return found.title;
      }
      return materialId;
    },
    [materials],
  );

  async function handlePassed(moduleId: string, result: TrainingResult) {
    if (!currentUser) return;
    setSaving(true);
    setError(null);
    try {
      await markTrainingModulePassed(currentUser._id, moduleId, {
        correct: result.correct,
        total: result.total,
      });
      // The lead's log reads the same documents — refresh its cache too, so a
      // senior consultant opening "Administration" next sees something current.
      await getAllTrainingProgress().catch(() => undefined);
      reloadProgress();
      setTestingId(null);
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  }

  if (!currentUser) {
    return (
      <div className="training-program">
        <h1 className="training-program__title">Training programme</h1>
        <p className="training-program__hint">
          The programme belongs to a person: to track progress you need to sign in with your own
          account.
        </p>
      </div>
    );
  }

  const done = statuses.filter((s) => s.passed).length;

  return (
    <div className="training-program">
      <h1 className="training-program__title">Training programme</h1>
      <p className="training-program__hint">
        Seven blocks in the order of the induction checklist. Inside a block are the materials of its
        section; opening one counts towards progress. Once all of them are open the block test
        unlocks — and it has to be passed without a single wrong answer. Blocks you have passed stay
        here so you can come back to them.
      </p>

      {statuses.length > 0 && (
        <p className="training-program__overall">
          Blocks passed: <strong>{done}</strong> of {statuses.length}
          {isProgramComplete(statuses) ? " — the programme is complete." : "."}
        </p>
      )}

      {error && <p className="training-program__error">{error}</p>}
      {(!materials || !progress) && !error && <p className="training-program__hint">Loading…</p>}

      <div className="training-program__cards">
        {statuses.map((status) => {
          const module = status.module;
          const list = materials?.find((x) => x.moduleId === module.id)?.materials ?? [];
          const isOpen = openId === module.id;
          const isTesting = testingId === module.id;

          return (
            <section
              key={module.id}
              className={"training-card" + (status.passed ? " training-card--passed" : "")}
            >
              <header className="training-card__head">
                <h2 className="training-card__title">
                  {module.title}
                  {status.passed && <span className="training-card__badge">passed</span>}
                </h2>
                <p className="training-card__why">{module.why}</p>
              </header>

              <div
                className="training-card__bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent(status.ratio)}
                aria-label={`Progress of the “${module.title}” block`}
              >
                <div className="training-card__bar-fill" style={{ width: `${percent(status.ratio)}%` }} />
              </div>
              <p className="training-card__counter">
                Opened {status.viewed} of {status.total} — {percent(status.ratio)}%
                {!moduleHasTest(module) && " · background block, no test"}
                {status.pass && ` · test passed, ${status.pass.correct} of ${status.pass.total}`}
              </p>

              <div className="training-card__actions">
                <button
                  type="button"
                  className="training-card__button"
                  onClick={() => {
                    setOpenId(isOpen ? null : module.id);
                    setTestingId(null);
                  }}
                >
                  {isOpen ? "Hide materials" : `Materials (${status.total})`}
                </button>
                {moduleHasTest(module) && !status.passed && (
                  <button
                    type="button"
                    className="training-card__button training-card__button--primary"
                    disabled={!status.testUnlocked}
                    title={
                      status.testUnlocked
                        ? undefined
                        : "The test unlocks once every material in the block has been opened"
                    }
                    onClick={() => {
                      setTestingId(isTesting ? null : module.id);
                      setOpenId(null);
                    }}
                  >
                    {isTesting ? "Close the test" : "Take the test"}
                  </button>
                )}
              </div>

              {isOpen && (
                <ul className="training-card__materials">
                  {list.map((m) => (
                    <li key={m._id} className="training-card__material">
                      <span
                        className={
                          "training-card__mark" +
                          (progress?.viewed[m._id] ? " training-card__mark--seen" : "")
                        }
                        aria-hidden="true"
                      >
                        {progress?.viewed[m._id] ? "✓" : "○"}
                      </span>
                      <Link to={`/material/${encodeURIComponent(m._id)}`}>{m.title}</Link>
                    </li>
                  ))}
                  {list.length === 0 && (
                    <li className="training-card__material">This section has no materials yet.</li>
                  )}
                </ul>
              )}

              {isTesting && (
                <div className="training-card__quiz">
                  <TrainingQuiz
                    questions={module.questions}
                    intro={`Test for the “${module.title}” block. ${module.questions.length} question(s), passed without mistakes.`}
                    sourceLabel={titleOf}
                    busy={saving}
                    error={error}
                    onPassed={(result) => void handlePassed(module.id, result)}
                    onBack={() => {
                      setTestingId(null);
                      setOpenId(module.id);
                    }}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
