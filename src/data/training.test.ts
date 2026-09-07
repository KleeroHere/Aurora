import { describe, expect, it } from "vitest";
import {
  TRAINING_MODULES,
  TRAINING_PASS_RATIO,
  TRAINING_QUESTIONS,
  TRAINING_STEPS,
  defaultTrainingSettings,
  emptyTrainingProgress,
  gradeAttempt,
  isProgramComplete,
  isTrainingAssigned,
  isTrainingRequired,
  moduleHasTest,
  moduleStatus,
} from "./training";
import type { TrainingProgress, TrainingQuestion } from "./training";

/** Every right answer — what somebody who passed the course has to score. */
function allCorrect(questions: TrainingQuestion[] = TRAINING_QUESTIONS): Record<string, number> {
  return Object.fromEntries(questions.map((q) => [q.id, q.correct]));
}

function assigned(patch: Partial<TrainingProgress> = {}): TrainingProgress {
  return { ...emptyTrainingProgress("user:1"), assignedAt: "2026-09-01T08:00:00Z", ...patch };
}

/** "article:intake__the-intake-interview" → "intake". */
function sectionOfMaterialId(id: string): string {
  return id.split(":")[1]?.split("__")[0] ?? "";
}

describe("what the induction course is made of", () => {
  it("every question rests on a page the course actually shows", () => {
    expect(TRAINING_QUESTIONS.length).toBeGreaterThan(0);
    const shown = new Set(TRAINING_STEPS.map((s) => s.id));
    for (const q of TRAINING_QUESTIONS) {
      expect(shown.has(q.source), `question ${q.id} points at a page outside the course`).toBe(true);
    }
  });

  it("every page of the course has text to show", () => {
    expect(TRAINING_STEPS.length).toBeGreaterThan(0);
    for (const step of TRAINING_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.blocks.length).toBeGreaterThan(0);
    }
  });

  it("every question has a right answer that exists and more than one option", () => {
    for (const q of TRAINING_QUESTIONS) {
      expect(q.options.length).toBeGreaterThan(1);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(q.options.length);
    }
  });

  it("question ids do not repeat — answers would overwrite each other", () => {
    const ids = TRAINING_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("course steps do not repeat", () => {
    const ids = TRAINING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("what the programme is made of: seven blocks", () => {
  it("has seven blocks with distinct keys, and no section lands in two of them", () => {
    expect(TRAINING_MODULES).toHaveLength(7);
    expect(new Set(TRAINING_MODULES.map((m) => m.id)).size).toBe(7);
    const sections = TRAINING_MODULES.flatMap((m) => m.sectionIds);
    expect(new Set(sections).size).toBe(sections.length);
    for (const m of TRAINING_MODULES) expect(m.sectionIds.length).toBeGreaterThan(0);
  });

  it("a block may be assembled from several sections", () => {
    const multi = TRAINING_MODULES.filter((m) => m.sectionIds.length > 1);
    expect(multi.length).toBeGreaterThan(0);
  });

  it("exactly one block has no test — it is the background reading", () => {
    const withoutTest = TRAINING_MODULES.filter((m) => !moduleHasTest(m));
    expect(withoutTest.map((m) => m.id)).toEqual(["outside"]);
  });

  it("questions in every test are well formed and their ids never collide", () => {
    const seen = new Set<string>();
    for (const module of TRAINING_MODULES) {
      for (const q of module.questions) {
        expect(q.options.length, `${module.id}/${q.id}: too few options`).toBeGreaterThan(1);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(q.options.length);
        expect(q.question.trim().length).toBeGreaterThan(10);
        expect(seen.has(q.id), `duplicate question id ${q.id}`).toBe(false);
        seen.add(q.id);
      }
    }
    // And they do not collide with the induction course either.
    for (const q of TRAINING_QUESTIONS) expect(seen.has(q.id)).toBe(false);
  });

  it("every block test has at least four questions", () => {
    for (const module of TRAINING_MODULES.filter(moduleHasTest)) {
      expect(module.questions.length, `${module.id}`).toBeGreaterThanOrEqual(4);
    }
  });

  it("a question points at a material from one of its own block's sections", () => {
    for (const module of TRAINING_MODULES) {
      const sections = module.sectionIds.map((id) => id.replace("section:", ""));
      for (const q of module.questions) {
        const from = sectionOfMaterialId(q.source);
        expect(
          sections.includes(from),
          `${module.id}/${q.id}: source ${q.source} belongs to another section`,
        ).toBe(true);
      }
    }
  });
});

describe("marking: the bar is 100 %", () => {
  it("every answer right — the course is passed", () => {
    const result = gradeAttempt({ answers: allCorrect() });
    expect(result.correct).toBe(TRAINING_QUESTIONS.length);
    expect(result.passed).toBe(true);
    expect(result.reviewSources).toEqual([]);
  });

  it("one wrong answer — not passed: the bar is exactly 100 %, not “nearly”", () => {
    const answers = allCorrect();
    const first = TRAINING_QUESTIONS[0];
    answers[first.id] = (first.correct + 1) % first.options.length;

    const result = gradeAttempt({ answers });
    expect(result.correct).toBe(TRAINING_QUESTIONS.length - 1);
    expect(result.passed).toBe(false);
    expect(TRAINING_PASS_RATIO).toBe(1);
  });

  it("an unanswered question counts as wrong rather than being skipped", () => {
    const answers = allCorrect();
    delete answers[TRAINING_QUESTIONS[0].id];
    expect(gradeAttempt({ answers }).passed).toBe(false);
  });

  it("names pages to re-read without giving away which questions failed", () => {
    const answers = allCorrect();
    const sameSource = TRAINING_QUESTIONS.filter((q) => q.source === TRAINING_QUESTIONS[0].source);
    expect(sameSource.length).toBeGreaterThan(1);
    for (const q of sameSource.slice(0, 2)) answers[q.id] = (q.correct + 1) % q.options.length;

    const result = gradeAttempt({ answers });
    expect(result.reviewSources).toEqual([TRAINING_QUESTIONS[0].source]);
    expect(Object.keys(result)).not.toContain("wrongQuestionIds");
  });

  it("a block test is marked against its own questions, not the course's", () => {
    const module = TRAINING_MODULES.find(moduleHasTest)!;
    const result = gradeAttempt({ answers: allCorrect(module.questions) }, module.questions);
    expect(result.total).toBe(module.questions.length);
    expect(result.passed).toBe(true);
  });
});

describe("who needs the course", () => {
  const on = { enabled: true };

  it("training switched off altogether is required of nobody", () => {
    expect(isTrainingRequired({ preferences: {} }, { enabled: false }, assigned())).toBe(false);
  });

  it("the master switch is on by default — but starts nothing on its own", () => {
    expect(defaultTrainingSettings().enabled).toBe(true);
    // Not assigned means not required, even with the switch on.
    expect(isTrainingRequired({ preferences: {} }, on, emptyTrainingProgress("user:1"))).toBe(false);
    expect(isTrainingRequired({ preferences: {} }, on, null)).toBe(false);
  });

  it("somebody assigned and without a mark does need it", () => {
    expect(isTrainingRequired({ preferences: {} }, on, assigned())).toBe(true);
  });

  it("somebody who passed does not", () => {
    const user = { preferences: { trainingCompletedAt: "2026-09-01T10:00:00Z" } };
    expect(isTrainingRequired(user, on, assigned())).toBe(false);
  });

  it("signing in without an account never requires the course: nowhere to record it", () => {
    expect(isTrainingRequired(null, on, assigned())).toBe(false);
  });

  it("assignment is recognised by its date, not by the document existing", () => {
    expect(isTrainingAssigned(emptyTrainingProgress("user:1"))).toBe(false);
    expect(isTrainingAssigned(assigned())).toBe(true);
    expect(isTrainingAssigned(null)).toBe(false);
  });
});

describe("progress within a block", () => {
  const withTest = TRAINING_MODULES.find(moduleHasTest)!;
  const withoutTest = TRAINING_MODULES.find((m) => !moduleHasTest(m))!;
  const ids = ["article:a", "article:b", "article:c", "article:d"];

  it("counts the share opened and does not unlock the test early", () => {
    const progress = assigned({ viewed: { "article:a": "t", "article:b": "t" } });
    const status = moduleStatus(progress, withTest, ids);
    expect(status.viewed).toBe(2);
    expect(status.total).toBe(4);
    expect(status.ratio).toBe(0.5);
    expect(status.testUnlocked).toBe(false);
    expect(status.passed).toBe(false);
  });

  it("all materials open — the test is available, but the block is NOT passed yet", () => {
    const viewed = Object.fromEntries(ids.map((id) => [id, "t"]));
    const status = moduleStatus(assigned({ viewed }), withTest, ids);
    expect(status.testUnlocked).toBe(true);
    expect(status.passed).toBe(false);
  });

  it("a block with a test closes on the pass mark", () => {
    const viewed = Object.fromEntries(ids.map((id) => [id, "t"]));
    const progress = assigned({
      viewed,
      modules: { [withTest.id]: { passedAt: "t", correct: 4, total: 4 } },
    });
    expect(moduleStatus(progress, withTest, ids).passed).toBe(true);
  });

  it("a block WITHOUT a test closes by reading — it has no other way", () => {
    const viewed = Object.fromEntries(ids.map((id) => [id, "t"]));
    expect(moduleStatus(assigned({ viewed }), withoutTest, ids).passed).toBe(true);
    expect(moduleStatus(assigned(), withoutTest, ids).passed).toBe(false);
  });

  it("an empty section does not hold the programme open forever", () => {
    const status = moduleStatus(assigned(), withoutTest, []);
    expect(status.ratio).toBe(1);
    expect(status.passed).toBe(true);
  });

  it("the programme is complete only when every block is closed", () => {
    const viewed = Object.fromEntries(ids.map((id) => [id, "t"]));
    const all = TRAINING_MODULES.map((m) =>
      moduleStatus(
        assigned({
          viewed,
          modules: Object.fromEntries(
            TRAINING_MODULES.map((x) => [x.id, { passedAt: "t", correct: 1, total: 1 }]),
          ),
        }),
        m,
        ids,
      ),
    );
    expect(isProgramComplete(all)).toBe(true);

    const one = TRAINING_MODULES.map((m) => moduleStatus(assigned({ viewed }), m, ids));
    expect(isProgramComplete(one)).toBe(false);
    expect(isProgramComplete([])).toBe(false);
  });
});
