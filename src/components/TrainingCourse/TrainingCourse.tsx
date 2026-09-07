import { useCallback, useEffect, useRef, useState } from "react";
import BlockRenderer from "../BlockRenderer/BlockRenderer";
import { updateUserPreferences } from "../../data/repository";
import {
  TRAINING_QUESTIONS,
  TRAINING_STEPS,
  gradeAttempt,
} from "../../data/training";
import type { TrainingResult } from "../../data/training";
import { humanError } from "../../utils/humanText";
import "./TrainingCourse.css";

/**
 * The induction course — the screen between signing in and the app itself.
 *
 * What the course contains and which questions it asks live in data/training.ts,
 * along with the reasoning for why this demo build shows two placeholder pages
 * and three easy questions where the centre's build shows four articles of the
 * handbook and ten questions on them.
 *
 * Three decisions worth knowing before editing this screen:
 *
 * 1. **"Next" waits until the page has been scrolled to the end.** Not a
 *    defence against bad faith (trivially bypassed) but against absent-minded
 *    skipping: somebody hammering "Next" by reflex hits a disabled button and at
 *    least learns what is being asked of them. If the page is shorter than the
 *    screen and there is nothing to scroll, the button is live immediately —
 *    otherwise it would never enable at all.
 *
 * 2. **The completion mark is written BEFORE letting anybody through, and only
 *    after a successful attempt.** The order matters: what should fail is the
 *    write, not the silent loss of a result for somebody already inside.
 *
 * 3. **A failed attempt does not say which questions were wrong** (see
 *    `gradeAttempt`).
 */

type Phase = "reading" | "test" | "result";

export default function TrainingCourse({
  userId,
  displayName,
  onFinished,
}: {
  userId: string;
  displayName: string;
  onFinished: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("reading");
  const [stepIndex, setStepIndex] = useState(0);
  const [readToEnd, setReadToEnd] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const step = TRAINING_STEPS[stepIndex];
  const isLastStep = stepIndex === TRAINING_STEPS.length - 1;

  useEffect(() => {
    setReadToEnd(false);
  }, [phase, step]);

  /** Scrolled to the end — and "nothing to scroll" counts as the end too. */
  const checkScrolled = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const room = el.scrollHeight - el.clientHeight;
    if (room <= 8 || el.scrollTop >= room - 40) setReadToEnd(true);
  }, []);

  useEffect(() => {
    // The page has just rendered — check straight away: a short one will never
    // fire a scroll event.
    if (phase === "reading") checkScrolled();
  }, [phase, step, checkScrolled]);

  async function finish(passed: TrainingResult) {
    setSaving(true);
    setError(null);
    try {
      await updateUserPreferences(userId, {
        trainingCompletedAt: new Date().toISOString(),
        trainingScore: { correct: passed.correct, total: passed.total },
      });
      onFinished();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit() {
    const graded = gradeAttempt({ answers });
    setResult(graded);
    setPhase("result");
    if (graded.passed) void finish(graded);
  }

  const answeredAll = TRAINING_QUESTIONS.every((q) => answers[q.id] !== undefined);

  return (
    <div className="training">
      <header className="training__header">
        <div>
          <h1 className="training__title">Induction course</h1>
          <p className="training__subtitle">
            {displayName}, this is your first sign-in. Read {TRAINING_STEPS.length} pages and answer{" "}
            {TRAINING_QUESTIONS.length} questions — after that the whole handbook opens.
          </p>
        </div>
        <ol className="training__steps" aria-label="Course steps">
          {TRAINING_STEPS.map((s, i) => (
            <li
              key={s.id}
              className={
                "training__step" +
                (phase === "reading" && i === stepIndex ? " training__step--current" : "") +
                (phase !== "reading" || i < stepIndex ? " training__step--done" : "")
              }
            >
              {i + 1}
            </li>
          ))}
          <li
            className={"training__step" + (phase !== "reading" ? " training__step--current" : "")}
            title="Test"
          >
            ✓
          </li>
        </ol>
      </header>

      {phase === "reading" && (
        <>
          <div className="training__body" ref={scrollRef} onScroll={checkScrolled}>
            {step && (
              <article className="training__article">
                <p className="training__why">{step.why}</p>
                <h2 className="training__article-title">{step.title}</h2>
                <BlockRenderer data={step.body} />
              </article>
            )}
          </div>

          <footer className="training__footer">
            <button
              type="button"
              className="training__button training__button--secondary"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={stepIndex === 0}
            >
              Back
            </button>
            <span className="training__counter">
              Page {stepIndex + 1} of {TRAINING_STEPS.length}
              {!readToEnd ? " — scroll to the end" : ""}
            </span>
            <button
              type="button"
              className="training__button training__button--primary"
              disabled={!readToEnd}
              onClick={() => {
                if (isLastStep) setPhase("test");
                else setStepIndex((i) => i + 1);
              }}
            >
              {isLastStep ? "To the test" : "Next"}
            </button>
          </footer>
        </>
      )}

      {phase === "test" && (
        <>
          <div className="training__body">
            <p className="training__why">
              {TRAINING_QUESTIONS.length} questions on what you have read. Every one has to be right —
              if you get one wrong, you can re-read and try again.
            </p>
            <ol className="training__questions">
              {TRAINING_QUESTIONS.map((q) => (
                <li key={q.id} className="training__question">
                  <p className="training__question-text">{q.question}</p>
                  {q.options.map((option, i) => (
                    <label key={i} className="training__option">
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === i}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </li>
              ))}
            </ol>
          </div>
          <footer className="training__footer">
            <button
              type="button"
              className="training__button training__button--secondary"
              onClick={() => {
                setPhase("reading");
                setStepIndex(0);
              }}
            >
              Re-read the pages
            </button>
            <span className="training__counter">
              Answered {Object.keys(answers).length} of {TRAINING_QUESTIONS.length}
            </span>
            <button
              type="button"
              className="training__button training__button--primary"
              disabled={!answeredAll}
              onClick={handleSubmit}
            >
              Check
            </button>
          </footer>
        </>
      )}

      {phase === "result" && result && (
        <div className="training__body">
          {result.passed ? (
            <div className="training__result">
              <h2 className="training__article-title">
                All correct — {result.correct} of {result.total}
              </h2>
              <p className="training__why">
                Course passed. {saving ? "Recording it…" : "Opening the handbook…"}
              </p>
              {error && (
                <>
                  <p className="training__error">Could not record it: {error}</p>
                  <button
                    type="button"
                    className="training__button training__button--primary"
                    onClick={() => void finish(result)}
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="training__result">
              <h2 className="training__article-title">
                {result.correct} of {result.total} correct
              </h2>
              <p className="training__why">
                Every answer has to be right. The app does not show which ones were wrong — that
                would turn the test into a search through the options. Go back to the pages below
                and try again.
              </p>
              <ul className="training__review">
                {result.reviewSources.map((id) => {
                  const idx = TRAINING_STEPS.findIndex((s) => s.id === id);
                  return <li key={id}>Page {idx >= 0 ? idx + 1 : "?"} of the course</li>;
                })}
              </ul>
              <div className="training__footer training__footer--inline">
                <button
                  type="button"
                  className="training__button training__button--secondary"
                  onClick={() => {
                    setPhase("reading");
                    setStepIndex(0);
                    setResult(null);
                  }}
                >
                  Re-read the pages
                </button>
                <button
                  type="button"
                  className="training__button training__button--primary"
                  onClick={() => {
                    setAnswers({});
                    setResult(null);
                    setPhase("test");
                  }}
                >
                  Take the test again
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
