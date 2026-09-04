import { seedMaterialId } from "./seedData";
import type { TrainingQuestion } from "./training";

/**
 * Questions for the blocks of the induction programme.
 *
 * One rule governs every question here: **the answer must be written, in those
 * words, in a material the block actually shows.** The pass mark is 100 %, so a
 * question whose answer is not on the page turns the test from a check into a
 * lottery — and a lottery a person cannot win by reading.
 *
 * `source` is the material to go back to. It is shown after a failed attempt
 * without saying which question was wrong: see `gradeAttempt` for why.
 */

const article = (section: string, name: string) => seedMaterialId("article", section, name);
const film = (section: string, name: string) => seedMaterialId("film", section, name);

// --- 1. Intake and first days -------------------------------------------------

export const QUESTIONS_INTAKE: TrainingQuestion[] = [
  {
    id: "q-intake-rules",
    question: "A newcomer has just come through the door. When are the house rules read with them?",
    options: [
      "At the door, before anything else",
      "Together, on the second day",
      "At the first morning circle",
      "Only if they ask about them",
    ],
    correct: 1,
    source: article("intake", "The first twenty-four hours"),
  },
  {
    id: "q-intake-notes",
    question: "During the intake interview, when do you write things down?",
    options: [
      "As they speak, so nothing is lost",
      "Afterwards, not during",
      "Together with them, line by line",
      "Only what they ask you to write",
    ],
    correct: 1,
    source: article("intake", "The intake interview"),
  },
  {
    id: "q-intake-exhausted",
    question:
      "The person who has just arrived is exhausted and frightened, and cannot hold a conversation. What do you do?",
    options: [
      "Push through the questions — it will be harder tomorrow",
      "Ask a resident to sit in and help",
      "Stop and let them sleep; the interview keeps until morning",
      "Fill the sheet in from the paperwork instead",
    ],
    correct: 2,
    source: article("intake", "The intake interview"),
  },
  {
    id: "q-intake-night",
    question: "How is the night shift told that somebody new has arrived?",
    options: [
      "By name, not with the word “newcomer” in the log",
      "With a note left on the office door",
      "Only if the person seems upset",
      "At the morning circle the next day",
    ],
    correct: 0,
    source: article("intake", "The first twenty-four hours"),
  },
];

// --- 2. The daily programme ---------------------------------------------------

export const QUESTIONS_PROGRAMME: TrainingQuestion[] = [
  {
    id: "q-prog-pass",
    question: "Someone passes at the morning circle for the third morning running. What is that?",
    options: [
      "A discipline problem for the lead to handle",
      "A conversation to have privately, after breakfast",
      "A reason to ask the circle to encourage them",
      "Normal — nothing needs doing",
    ],
    correct: 1,
    source: article("programme", "Opening the morning circle"),
  },
  {
    id: "q-prog-ring",
    question: "Why one ring of chairs and never a second row?",
    options: [
      "The room is too small for two rows",
      "A second row makes the circle run long",
      "A second row creates an audience, and an audience changes what people will say",
      "People at the back cannot hear the facilitator",
    ],
    correct: 2,
    source: article("programme", "Opening the morning circle"),
  },
  {
    id: "q-prog-conflict",
    question: "A conflict between two residents surfaces during the circle. What does the protocol say?",
    options: [
      "Settle it there — the whole house has already seen it",
      "Note it, close the circle on time, and deal with it after",
      "Extend the circle until both have spoken",
      "Send both out and carry on",
    ],
    correct: 1,
    source: article("programme", "Opening the morning circle"),
  },
  {
    id: "q-prog-chores",
    question: "Can a chore be taken away from someone as a penalty?",
    options: [
      "Yes, if the duty consultant agrees",
      "Yes, for the heavy duties only",
      "No — that turns a shared duty into leverage; penalties go through the house rules",
      "Only with the lead's written approval",
    ],
    correct: 2,
    source: article("programme", "The chores rota"),
  },
];

// --- 3. Night shift -----------------------------------------------------------

export const QUESTIONS_NIGHT: TrainingQuestion[] = [
  {
    id: "q-night-rounds",
    question: "How often are rounds done through the night?",
    options: [
      "Once, an hour after lights out",
      "Every two hours until morning",
      "Every thirty minutes",
      "Only when something is heard",
    ],
    correct: 1,
    source: article("night-shift", "The quiet hours"),
  },
  {
    id: "q-night-three-am",
    question: "Somebody who cannot sleep finds you in the office at three in the morning.",
    options: [
      "Send them back to bed — the rule is the rule",
      "Wake the lead straight away",
      "Make tea and listen; do not send them back on principle",
      "Note it in the log and speak in the morning",
    ],
    correct: 2,
    source: article("night-shift", "The quiet hours"),
  },
  {
    id: "q-night-ladder",
    question: "You are not sure which rung of the escalation ladder you are on. What does the protocol say?",
    options: [
      "Stay on the lower rung until you are certain",
      "You are on the next one up — uncertainty at night is itself a reason to call",
      "Ask another resident what they think",
      "Wait until the morning handover",
    ],
    correct: 1,
    source: article("night-shift", "The quiet hours"),
  },
  {
    id: "q-night-handover",
    question: "A handover sent as a message counts as what?",
    options: [
      "A handover, if it is detailed enough",
      "A handover, once the next shift replies",
      "A handover that did not happen",
      "A handover, if the log is filled in later",
    ],
    correct: 2,
    source: article("night-shift", "Handover between shifts"),
  },
];

// --- 4. Groups and film work --------------------------------------------------

export const QUESTIONS_GROUPS: TrainingQuestion[] = [
  {
    id: "q-groups-order",
    question: "In a check-in group, how is the speaking order decided?",
    options: [
      "Around the ring — no volunteering, no picking",
      "Whoever raises a hand first",
      "The facilitator picks, starting with the quietest",
      "By the chores rota for that week",
    ],
    correct: 0,
    source: article("group-work", "Running a check-in group"),
  },
  {
    id: "q-groups-flat",
    question: "The room is flat and the third question in a row has died. What does that mean?",
    options: [
      "The group is not ready for this work",
      "The question is wrong or worn out — drop it out loud and ask a smaller one",
      "Someone should be asked to leave",
      "The session should end early",
    ],
    correct: 1,
    source: article("group-work", "When the group goes silent"),
  },
  {
    id: "q-groups-badly",
    question: "The group answers the film questions badly. What does the protocol say?",
    options: [
      "Correct them — the film has a point to make",
      "Let them answer badly; supplying the right reading teaches nothing",
      "Stop the discussion and rewatch the scene",
      "Move to a different film next week",
    ],
    correct: 1,
    source: film("film-therapy", "Starting over"),
  },
  {
    id: "q-groups-prepare",
    question: "What must the consultant do before running a film session?",
    options: [
      "Read the discussion questions aloud to the group first",
      "Check that everyone has seen the film before",
      "Watch the film themselves first, with the questions in front of them",
      "Agree the questions with the lead",
    ],
    correct: 2,
    source: article("film-therapy", "Running a film discussion"),
  },
];

// --- 5. Crisis situations -----------------------------------------------------

export const QUESTIONS_CRISIS: TrainingQuestion[] = [
  {
    id: "q-crisis-first-minutes",
    question: "Two residents are shouting at each other. What are the first three minutes for?",
    options: [
      "Finding out who started it, while the memory is fresh",
      "Separating them — not adjudicating",
      "Asking the room what happened",
      "Getting both to apologise before it hardens",
    ],
    correct: 1,
    source: article("crisis", "Conflict between residents"),
  },
  {
    id: "q-crisis-leaving",
    question: "A resident intends to leave. Which of these is never allowed?",
    options: [
      "Calling the lead while they gather their things",
      "Offering tea, food or sleep first",
      "Blocking a doorway, taking a phone, or holding on to documents",
      "Returning their belongings by the inventory",
    ],
    correct: 2,
    source: article("crisis", "A resident wants to leave"),
  },
  {
    id: "q-crisis-relapse",
    question: "You suspect a relapse. Who do you tell first?",
    options: [
      "The person themselves, in front of the group",
      "The lead, before anybody else",
      "The next shift, at handover",
      "Their family",
    ],
    correct: 1,
    source: article("crisis", "Suspected relapse"),
  },
  {
    id: "q-crisis-medical",
    question: "A medical emergency. What happens first?",
    options: [
      "Call the emergency number — everything else happens while you wait",
      "Find the person's file and their next of kin",
      "Call the lead and ask what to do",
      "Move the person to the office",
    ],
    correct: 0,
    source: article("crisis", "Medical emergency"),
  },
];

// --- 6. Journals, forms and house rules ---------------------------------------

export const QUESTIONS_RECORDS: TrainingQuestion[] = [
  {
    id: "q-records-when",
    question: "When is a journal entry written?",
    options: [
      "The same shift, not reconstructed the next morning",
      "At the end of the week, all at once",
      "Whenever there is a quiet moment",
      "By the next shift, from what they were told",
    ],
    correct: 0,
    source: article("records", "Why we keep journals"),
  },
  {
    id: "q-records-what",
    question: "What belongs in an entry?",
    options: [
      "Your reading of why it happened",
      "Facts and observations; conclusions belong in the conversation with the lead",
      "Everything said, as close to verbatim as you can manage",
      "Only what the next shift asks about",
    ],
    correct: 1,
    source: article("records", "Why we keep journals"),
  },
  {
    id: "q-records-twice",
    question: "You notice you are writing the same sentence into two different journals.",
    options: [
      "That is correct — both journals need it",
      "One of the two entries is in the wrong place",
      "Write it in the more important one only",
      "Ask the lead which journal wins",
    ],
    correct: 1,
    source: article("records", "Filling journals without drowning in paper"),
  },
  {
    id: "q-records-money",
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
];
