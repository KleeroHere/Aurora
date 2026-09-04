import { useState } from "react";
import { gradeAttempt } from "../../data/training";
import type { TrainingQuestion, TrainingResult } from "../../data/training";
import "./TrainingQuiz.css";

/**
 * A test: questions, marking, retakes.
 *
 * Shared by the induction course and by the blocks of the programme — their
 * rules are the same and must not drift apart: 100 % to pass, retakes are free,
 * and a failure does NOT show which questions were wrong. That last part is not
 * spite: with a 100 % bar and free retakes, highlighting the wrong answers would
 * turn the test into a search through the options one at a time. What it names
 * are the articles worth going back to — enough to know what to re-read.
 */
export default function TrainingQuiz({
  questions,
  intro,
  sourceLabel,
  onPassed,
  onBack,
  backLabel = "Back to the materials",
  busy = false,
  error,
}: {
  questions: TrainingQuestion[];
  intro: string;
  /** How to name a source article in the "what to re-read" list. */
  sourceLabel: (materialId: string) => string;
  onPassed: (result: TrainingResult) => void;
  onBack: () => void;
  backLabel?: string;
  /** The result is being written — buttons are locked. */
  busy?: boolean;
  error?: string | null;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<TrainingResult | null>(null);

  const answeredAll = questions.every((q) => answers[q.id] !== undefined);

  function submit() {
    const graded = gradeAttempt({ answers }, questions);
    setResult(graded);
    if (graded.passed) onPassed(graded);
  }

  if (result && !result.passed) {
    return (
      <div className="quiz__result">
        <h3 className="quiz__result-title">
          {result.correct} of {result.total} correct
        </h3>
        <p className="quiz__hint">
          The test is passed with every answer right. The app does not show which ones were wrong —
          that would turn the test into a search through the options. Go back to the materials and
          try again.
        </p>
        <p className="quiz__hint">Worth re-reading:</p>
        <ul className="quiz__review">
          {result.reviewSources.map((id) => (
            <li key={id}>{sourceLabel(id)}</li>
          ))}
        </ul>
        <div className="quiz__actions">
          <button type="button" className="quiz__button quiz__button--secondary" onClick={onBack}>
            {backLabel}
          </button>
          <button
            type="button"
            className="quiz__button quiz__button--primary"
            onClick={() => {
              setAnswers({});
              setResult(null);
            }}
          >
            Take the test again
          </button>
        </div>
      </div>
    );
  }

  if (result?.passed) {
    return (
      <div className="quiz__result">
        <h3 className="quiz__result-title">
          All correct — {result.correct} of {result.total}
        </h3>
        <p className="quiz__hint">{busy ? "Recording…" : "Test passed."}</p>
        {error && (
          <>
            <p className="quiz__error">Could not record it: {error}</p>
            <button type="button" className="quiz__button quiz__button--primary" onClick={() => onPassed(result)}>
              Try again
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="quiz">
      <p className="quiz__hint">{intro}</p>
      <ol className="quiz__questions">
        {questions.map((q) => (
          <li key={q.id} className="quiz__question">
            <p className="quiz__question-text">{q.question}</p>
            {q.options.map((option, i) => (
              <label key={i} className="quiz__option">
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
      <div className="quiz__actions">
        <button type="button" className="quiz__button quiz__button--secondary" onClick={onBack}>
          {backLabel}
        </button>
        <span className="quiz__counter">
          Answered {Object.keys(answers).length} of {questions.length}
        </span>
        <button
          type="button"
          className="quiz__button quiz__button--primary"
          disabled={!answeredAll || busy}
          onClick={submit}
        >
          Check
        </button>
      </div>
    </div>
  );
}
