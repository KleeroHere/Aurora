import { SCHEMA_VERSION } from "./types";
import { seedMaterialId } from "./seedData";
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
 *   - **The induction course** — four articles and a ten-question test, shown
 *     the first time a person signs in. It is a hard gate: no full access to the
 *     app until it is passed, and the pass mark is every question right.
 *   - **The programme** — seven blocks covering the whole handbook, each with
 *     its own progress bar and its own test. Not a gate: it runs alongside the
 *     work over the first month, and the programme lead watches it from their
 *     own machine.
 *
 * HOW TO CHANGE IT. The steps, blocks and questions below are plain data. The
 * order of the steps is the order they are shown in. Changing them needs a
 * rebuild: the course is deliberately NOT kept in the database, because a sync
 * with the server could otherwise swap the questions out from under somebody
 * halfway through their test. If it ever needs to be editable without a
 * rebuild, move it into a settings document — and then protect that document
 * from replication, the way `seedstate` is protected.
 */

export const TRAINING_SETTINGS_ID = "settings:training";

export interface TrainingStep {
  /** The `_id` of the material in the database. */
  materialId: string;
  /** Why this article is in the course — shown above the text. */
  why: string;
}

export interface TrainingQuestion {
  id: string;
  question: string;
  options: string[];
  /** Index of the right option in `options`. */
  correct: number;
  /** Which article the answer is in — used to suggest what to re-read. */
  source: string;
}

const article = (section: string, name: string) => seedMaterialId("article", section, name);

export const TRAINING_STEPS: TrainingStep[] = [
  {
    materialId: article("house-rules", "House rules in one page"),
    why: "What the house runs on. Read with every newcomer on their second day.",
  },
  {
    materialId: article("house-rules", "What consultants must not do"),
    why: "The limits on your side of the work. Any one of them ends the shift.",
  },
  {
    materialId: article("intake", "The first twenty-four hours"),
    why: "The shift you will be handed most often: somebody new at the door.",
  },
  {
    materialId: article("night-shift", "Handover between shifts"),
    why: "How a shift ends, and what the next one has to be told.",
  },
];

/**
 * The induction test.
 *
 * Every answer follows the text of the four articles above word for word. A
 * question whose answer is not written on a page the person was shown is not
 * allowed here: the pass mark is 100 %, and somebody must be able to reach it
 * by reading what they were given.
 */
export const TRAINING_QUESTIONS: TrainingQuestion[] = [
  {
    id: "q-door",
    question: "What does the house rule about the door say?",
    options: [
      "Nothing that alters your state comes through the door",
      "Only staff may open the door",
      "Deliveries are checked once a week",
      "The door is locked after lights out",
    ],
    correct: 0,
    source: article("house-rules", "House rules in one page"),
  },
  {
    id: "q-chores",
    question: "Who does a chore?",
    options: [
      "Whoever is free at the time",
      "The person whose name is on the rota",
      "The newest resident",
      "Whoever the duty consultant picks that morning",
    ],
    correct: 1,
    source: article("house-rules", "House rules in one page"),
  },
  {
    id: "q-money",
    question: "A resident asks to borrow money until the weekend. What do the limits say?",
    options: [
      "Lend it if the sum is small",
      "Lend it and tell the lead afterwards",
      "Do not lend or borrow money, from anyone, for any reason",
      "Lend it only against something of theirs",
    ],
    correct: 2,
    source: article("house-rules", "What consultants must not do"),
  },
  {
    id: "q-discussing",
    question: "Which of these is on the list of things a consultant must not do?",
    options: [
      "Discussing one resident with another",
      "Asking a resident how they slept",
      "Writing in the journal during a shift",
      "Sitting down during a conversation",
    ],
    correct: 0,
    source: article("house-rules", "What consultants must not do"),
  },
  {
    id: "q-unwell",
    question: "You are unwell enough that you need to sit down. What does the list say about working the shift?",
    options: [
      "Work it, but hand over early",
      "Do not work it",
      "Work it if there is nobody to replace you",
      "Work it, but do not run group",
    ],
    correct: 1,
    source: article("house-rules", "What consultants must not do"),
  },
  {
    id: "q-rules-day-two",
    question: "A newcomer has just arrived. When are the rules read?",
    options: [
      "At the door, before anything else",
      "Together, on the second day",
      "At the first morning circle",
      "Only if the person asks",
    ],
    correct: 1,
    source: article("intake", "The first twenty-four hours"),
  },
  {
    id: "q-bad-first-day",
    question: "Which of these is listed as a sign of a bad first day?",
    options: [
      "The newcomer heard four different versions of the schedule",
      "The newcomer went to bed early",
      "The newcomer did not speak at supper",
      "The newcomer asked to call home",
    ],
    correct: 0,
    source: article("intake", "The first twenty-four hours"),
  },
  {
    id: "q-warn-night",
    question: "How is the night shift warned that somebody new has arrived?",
    options: [
      "By name, not with the word “newcomer” in the log",
      "With a note on the office door",
      "Only if the person seems upset",
      "At the morning circle the next day",
    ],
    correct: 0,
    source: article("intake", "The first twenty-four hours"),
  },
  {
    id: "q-handover-message",
    question: "A handover sent as a message counts as what?",
    options: [
      "A handover, if it is detailed enough",
      "A handover that did not happen",
      "A handover, once the next shift replies",
      "A handover, if the log is filled in later",
    ],
    correct: 1,
    source: article("night-shift", "Handover between shifts"),
  },
  {
    id: "q-handover-cannot-meet",
    question: "You truly cannot meet for the handover. What does the rule say?",
    options: [
      "Send the log by message and ask them to sign it",
      "Phone — and write the log yourself, not the other person",
      "Ask a resident to pass it on",
      "Leave a note by the door",
    ],
    correct: 1,
    source: article("night-shift", "Handover between shifts"),
  },
];

/**
 * Every question right, or the attempt does not count.
 *
 * This is not strictness for its own sake. The course is four articles long and
 * the answers are on the page; at a lower bar somebody can get through it
 * without having read one of them, and the one they skipped is the one that
 * matters at three in the morning. Retakes are free and unlimited — the cost of
 * the high bar is a few minutes, not a job.
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

/**
 * Are all of the course articles actually in this database?
 *
 * The course is a gate that only passing it can lift. If the articles have not
 * reached this machine yet — a partial seed, a sync caught halfway — a person
 * would hit a screen that cannot be completed, and there would be nothing
 * inside the app to fix it with. So the gate is not raised at all while there
 * is nothing to show: a course that did not appear is a smaller problem than a
 * member of staff locked out.
 *
 * The loader is passed in as a parameter, so the check is visible in tests and
 * the data module does not drag the repository in behind it.
 */
export async function areCourseMaterialsAvailable(
  loadMaterial: (id: string) => Promise<unknown | null | undefined>,
  steps: TrainingStep[] = TRAINING_STEPS,
): Promise<boolean> {
  try {
    const found = await Promise.all(steps.map((s) => loadMaterial(s.materialId)));
    return found.every((m) => m !== null && m !== undefined);
  } catch {
    return false;
  }
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
