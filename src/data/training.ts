import { SCHEMA_VERSION } from "./types";
import type { EditorJsOutputData } from "./types";
import { buildOutputData, eBlockHeader, eBlockParagraph } from "./seedData";
import {
  QUESTIONS_CRISIS,
  QUESTIONS_GROUPS,
  QUESTIONS_INTAKE,
  QUESTIONS_NIGHT,
  QUESTIONS_PROGRAMME,
  QUESTIONS_RECORDS,
} from "./trainingQuestions";

/**
 * Induction for a new consultant.
 *
 * The problem it solves is an ordinary one in this kind of place: a new member
 * of staff is handed a folder and told to read it, and three weeks later nobody
 * can say what they actually read. The handbook already contains the induction
 * checklist; what was missing was a way to walk somebody through it and to know
 * that they got to the end.
 *
 * Two parts, deliberately different in weight:
 *
 *   - **The induction course** — a few pages and a test, shown the first time a
 *     person signs in. It is a gate: no full access to the app until it is
 *     passed, and the pass mark is every question right.
 *   - **The programme** — seven blocks covering the whole handbook, each with
 *     its own progress bar and its own test. Not a gate: it runs alongside the
 *     work over the first month, and the programme lead watches it from their
 *     own machine.
 *
 * IN THIS DEMO BUILD THE COURSE IS A STAND-IN. At the centre it is four
 * articles of the handbook and ten questions on them — twenty minutes of real
 * reading before the app opens. That is right for somebody starting a job and
 * wrong for somebody who opened the demo to look around: they would meet a wall
 * of text about a house they will never work in. So the demo ships two
 * placeholder pages and three questions anybody can answer, and a visitor is
 * through the gate in half a minute having seen exactly how it works.
 *
 * HOW TO PUT THE REAL COURSE BACK. The steps and questions below are plain
 * data: give each step the text it should show and each question a `source`
 * naming the step its answer is on. Changing them needs a rebuild: the course
 * is deliberately NOT kept in the database, because a sync with the server
 * could otherwise swap the questions out from under somebody halfway through
 * their test.
 *
 * The steps carry their own text rather than pointing at materials, which is
 * also why the course cannot arrive half-built: there is no way for the pages
 * to be missing from a machine the app itself reached.
 */

export const TRAINING_SETTINGS_ID = "settings:training";

export interface TrainingStep {
  /** Identifies the step. A question names it in `source`. */
  id: string;
  /** Shown as the heading of the page. */
  title: string;
  /** Why this page is in the course — shown above the text. */
  why: string;
  /** The text of the page, in the same block format as an article. */
  body: EditorJsOutputData;
}

export interface TrainingQuestion {
  id: string;
  question: string;
  options: string[];
  /** Index of the right option in `options`. */
  correct: number;
  /** Which page the answer is on — used to suggest what to re-read. */
  source: string;
}

export const TRAINING_STEPS: TrainingStep[] = [
  {
    id: "demo-what-this-is",
    title: "What this page is",
    why: "A placeholder. It stands where an article of the handbook stands in the real build.",
    body: buildOutputData([
      eBlockParagraph(
        "This page is a stand-in. In the build running at the centre the induction " +
          "course opens four articles of the handbook here — the house rules, the " +
          "limits on a consultant, the first twenty-four hours of a newcomer, the " +
          "handover between shifts — and a new member of staff reads them before the " +
          "app will open for them.",
      ),
      eBlockParagraph(
        "None of that is in the demo. What is here is the mechanism itself: pages " +
          "shown one after another, then a test, and the handbook behind it.",
      ),
      eBlockHeader("What to look at", 3),
      eBlockParagraph(
        "The “Next” button waits until the page has been scrolled to the end — on a " +
          "page this short there is nothing to scroll, so it is live at once. The test " +
          "after the last page has to be answered without a mistake, and a failed " +
          "attempt names the pages worth re-reading without saying which question went " +
          "wrong.",
      ),
    ]),
  },
  {
    id: "demo-and-then-a-test",
    title: "And then a test",
    why: "The second and last page of the demo course. Three questions after it.",
    body: buildOutputData([
      eBlockParagraph(
        "Three questions follow this page, and none of them is about rehabilitation. " +
          "They are there so the shape of the gate can be seen without asking a " +
          "visitor to study a handbook first.",
      ),
      eBlockParagraph(
        "The bar is every answer right, exactly as it is in production. Retakes are " +
          "free, so getting one wrong on purpose costs nothing but a click — and the " +
          "screen that comes back is worth looking at.",
      ),
    ]),
  },
];

/**
 * The induction test.
 *
 * Three questions, deliberately trivial: this is a demo of a gate, not of a
 * curriculum. The rule they keep from the real course is that the answer must
 * be reachable from what the person was shown — here, from general knowledge.
 */
export const TRAINING_QUESTIONS: TrainingQuestion[] = [
  {
    id: "q-two-plus-two",
    question: "How much is 2 + 2?",
    options: ["3", "4", "5", "22"],
    correct: 1,
    source: "demo-what-this-is",
  },
  {
    id: "q-sky",
    question: "What colour is the sky on a clear day?",
    options: ["Blue", "Green", "Brown", "Chequered"],
    correct: 0,
    source: "demo-what-this-is",
  },
  {
    id: "q-dog",
    question: "What does a dog say?",
    options: ["Moo", "Miaow", "Woof", "Nothing at all"],
    correct: 2,
    source: "demo-and-then-a-test",
  },
];

/**
 * Every question right, or the attempt does not count.
 *
 * This is not strictness for its own sake. In the real course the answers are
 * on the pages the person was just shown; at a lower bar somebody can get
 * through without having read one of them, and the one they skipped is the one
 * that matters at three in the morning. Retakes are free and unlimited — the
 * cost of the high bar is a few minutes, not a job.
 */
export const TRAINING_PASS_RATIO = 1;

export interface TrainingModule {
  id: string;
  /** Sections of the handbook this block covers. */
  sectionIds: string[];
  title: string;
  /** What the block is for — shown on its card. */
  why: string;
  /** An empty list means the block has no test: reading it through is enough. */
  questions: TrainingQuestion[];
}

const section = (slug: string) => `section:${slug}`;

export const TRAINING_MODULES: TrainingModule[] = [
  {
    id: "intake",
    sectionIds: [section("intake")],
    title: "Intake and first days",
    why: "The door, the first conversation, the first night.",
    questions: QUESTIONS_INTAKE,
  },
  {
    id: "programme",
    sectionIds: [section("programme")],
    title: "The daily programme",
    why: "The rhythm you will be running: circle, chores, groups, the close of the day.",
    questions: QUESTIONS_PROGRAMME,
  },
  {
    id: "night-shift",
    sectionIds: [section("night-shift")],
    title: "Night shift",
    why: "The quiet hours, and the handover that ends them.",
    questions: QUESTIONS_NIGHT,
  },
  {
    id: "groups",
    sectionIds: [section("group-work"), section("film-therapy")],
    title: "Groups and film work",
    why: "Running a group and running a film discussion. Both sections.",
    questions: QUESTIONS_GROUPS,
  },
  {
    id: "crisis",
    sectionIds: [section("crisis")],
    title: "Crisis situations",
    why: "When it goes off plan: conflict, leaving, relapse, injury.",
    questions: QUESTIONS_CRISIS,
  },
  {
    id: "records",
    sectionIds: [section("records"), section("house-rules")],
    title: "Journals, forms and house rules",
    why: "What gets written down, and the limits it is written against.",
    questions: QUESTIONS_RECORDS,
  },
  {
    id: "outside",
    sectionIds: [section("families"), section("aftercare")],
    title: "Families and aftercare",
    why: "The work that happens outside the house. Background reading — no test.",
    questions: [],
  },
];

export function findModule(id: string): TrainingModule | undefined {
  return TRAINING_MODULES.find((m) => m.id === id);
}

/** A block without a test is closed by reading all of its materials. */
export function moduleHasTest(module: TrainingModule): boolean {
  return module.questions.length > 0;
}

export interface TrainingSettings {
  _id: string;
  _rev?: string;
  type: "settings";
  schemaVersion: number;
  /** Require the course on first sign-in. Switched off under "Administration". */
  enabled: boolean;
  updatedAt: string;
}

/**
 * The master switch is on by default — and that is safe precisely because on
 * its own it starts nothing.
 *
 * Training appears for a member of staff only once somebody has ASSIGNED it to
 * them (see `isTrainingAssigned`). On a fresh install it is assigned to nobody,
 * so the switch being on changes nothing until a lead deliberately acts. The
 * switch exists for the other direction: the course is a hard gate, it is
 * lifted from inside the app, and a way to kill it in one movement has to
 * exist.
 */
export function defaultTrainingSettings(): TrainingSettings {
  return {
    _id: TRAINING_SETTINGS_ID,
    type: "settings",
    schemaVersion: SCHEMA_VERSION,
    enabled: true,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadTrainingSettings(systemDb: PouchDB.Database): Promise<TrainingSettings> {
  try {
    const doc = await systemDb.get<TrainingSettings>(TRAINING_SETTINGS_ID);
    return { ...defaultTrainingSettings(), ...doc };
  } catch (err) {
    if ((err as PouchDB.Core.Error).status === 404) return defaultTrainingSettings();
    throw err;
  }
}

export async function saveTrainingSettings(
  systemDb: PouchDB.Database,
  patch: Partial<Pick<TrainingSettings, "enabled">>,
): Promise<TrainingSettings> {
  const current = await loadTrainingSettings(systemDb);
  const next: TrainingSettings = { ...current, ...patch, updatedAt: new Date().toISOString() };
  const result = await systemDb.put(next as unknown as PouchDB.Core.PutDocument<Record<string, unknown>>);
  return { ...next, _rev: result.rev };
}

/**
 * Does this person need the induction course right now?
 *
 * Three conditions, all required:
 *   1. training is not switched off altogether (the master switch);
 *   2. it has been ASSIGNED to them — see `isTrainingAssigned`. Without this an
 *      update would demand the course from people who have worked here for
 *      three years;
 *   3. they have not passed it yet.
 *
 * Signing in anonymously (no accounts in the database at all) never requires
 * the course: there is nowhere to record that it was passed, and the person
 * would be stuck on it forever.
 */
export function isTrainingRequired(
  user: { preferences?: { trainingCompletedAt?: string } } | null,
  settings: { enabled: boolean },
  progress?: TrainingProgress | null,
): boolean {
  if (!settings.enabled) return false;
  if (!user) return false;
  if (!isTrainingAssigned(progress)) return false;
  return !user.preferences?.trainingCompletedAt;
}

// --- One person's progress ----------------------------------------------------

export const TRAINING_PROGRESS_PREFIX = "training:";

export function trainingProgressId(userId: string): string {
  return `${TRAINING_PROGRESS_PREFIX}${userId}`;
}

export interface ModulePass {
  passedAt: string;
  correct: number;
  total: number;
}

/**
 * The training progress of one member of staff. It lives in the SYSTEM database
 * and travels with a sync (`isReplicableDocId` filters out only seedstate,
 * applog, pin and _design): the senior consultant has to see progress from
 * their own machine, or the log is pointless.
 *
 * `viewed` is a map of "material → when it was opened", not a list of events: a
 * log of openings would grow by one document per press and clog the sync, while
 * exactly one thing is needed — opened or not.
 */
export interface TrainingProgress {
  _id: string;
  _rev?: string;
  type: "training";
  schemaVersion: number;
  userId: string;
  /** When a lead assigned the training. No assignment, no training. */
  assignedAt?: string;
  /** Who assigned it, for the log. */
  assignedBy?: string;
  viewed: Record<string, string>;
  modules: Record<string, ModulePass>;
  updatedAt: string;
}

export function emptyTrainingProgress(userId: string): TrainingProgress {
  return {
    _id: trainingProgressId(userId),
    type: "training",
    schemaVersion: SCHEMA_VERSION,
    userId,
    viewed: {},
    modules: {},
    updatedAt: new Date().toISOString(),
  };
}

export interface ModuleStatus {
  module: TrainingModule;
  total: number;
  viewed: number;
  /** Share read, 0..1. A block with no materials is 1, or it would never close. */
  ratio: number;
  /** The test unlocks only once every material in the block has been opened. */
  testUnlocked: boolean;
  passed: boolean;
  pass?: ModulePass;
}

/**
 * The state of a block, for its card.
 *
 * A block without a test counts as done when every material has been opened —
 * it has no other way to close. A block with a test closes only by passing it:
 * reading unlocks the test but proves nothing on its own (a person may have
 * scrolled past, and we know it — see TrainingCourse).
 */
export function moduleStatus(
  progress: TrainingProgress,
  module: TrainingModule,
  materialIds: string[],
): ModuleStatus {
  const total = materialIds.length;
  const viewed = materialIds.filter((id) => progress.viewed[id]).length;
  const ratio = total === 0 ? 1 : viewed / total;
  const allViewed = viewed >= total;
  const pass = progress.modules[module.id];
  return {
    module,
    total,
    viewed,
    ratio,
    testUnlocked: allViewed,
    passed: moduleHasTest(module) ? Boolean(pass) : allViewed,
    pass,
  };
}

/** The programme is complete when every block is closed. */
export function isProgramComplete(statuses: ModuleStatus[]): boolean {
  return statuses.length > 0 && statuses.every((s) => s.passed);
}

/**
 * Has training been assigned to this person?
 *
 * Assignment is what separates a new consultant from somebody in their third
 * year. Without it neither the induction course nor the programme badge appears
 * for anybody: an update must not turn into a demand that everyone go back to
 * school.
 */
export function isTrainingAssigned(progress: TrainingProgress | null | undefined): boolean {
  return Boolean(progress?.assignedAt);
}

export interface TrainingAttempt {
  /** Answers: question id → chosen index. */
  answers: Record<string, number>;
}

export interface TrainingResult {
  total: number;
  correct: number;
  passed: boolean;
  /** Articles worth going back to — without saying which question was failed. */
  reviewSources: string[];
}

/**
 * The result of an attempt.
 *
 * It deliberately does NOT say which questions were failed. With a 100 % pass
 * mark and free retakes, that would turn the test into a search through one
 * option at a time. What comes back is the articles worth re-reading: enough to
 * know what to look at, not enough to guess the answer.
 */
export function gradeAttempt(
  attempt: TrainingAttempt,
  questions: TrainingQuestion[] = TRAINING_QUESTIONS,
): TrainingResult {
  let correct = 0;
  const reviewSources = new Set<string>();
  for (const q of questions) {
    if (attempt.answers[q.id] === q.correct) correct += 1;
    else reviewSources.add(q.source);
  }
  return {
    total: questions.length,
    correct,
    passed: questions.length > 0 && correct / questions.length >= TRAINING_PASS_RATIO,
    reviewSources: [...reviewSources],
  };
}
