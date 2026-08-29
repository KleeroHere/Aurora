import type { FigureCardsSpec, FigurePyramidSpec, FigureRow, FigureTableSpec } from "./figureTypes";

function words(...cells: string[]): FigureRow {
  return { type: "cells", cells: cells.map((text) => ({ text })) };
}

/** A row of empty cells — space for handwriting on the printed sheet. */
function blanks(count: number): FigureRow {
  return { type: "cells", cells: Array.from({ length: count }, () => ({ text: "" })) };
}

/** A full-width subheading row that groups the rows below it. */
function band(text: string): FigureRow {
  return { type: "band", text };
}

/**
 * Built-in printable figures for the demo handbook. Each figure is attached
 * to a seeded material in materialFigures.ts and rendered by its kind:
 * table, pyramid, or cards.
 *
 * Everything here is written for this demo set: no quotations, no clinical
 * advice, nothing that names a substance or a diagnosis.
 */

export const FEELINGS_TABLE: FigureTableSpec = {
  kind: "table",
  caption: "A wider word for what you feel",
  columns: [
    { title: "Barely there", weight: 1 },
    { title: "Noticeable", weight: 1 },
    { title: "Plain to see", weight: 1 },
    { title: "Strong", weight: 1 },
    { title: "At full force", weight: 1 },
  ],
  rows: [
    band("Fear"),
    words("uneasy", "nervous", "anxious", "frightened", "terrified"),
    blanks(5),
    band("Anger"),
    words("annoyed", "irritated", "angry", "furious", "enraged"),
    blanks(5),
    band("Sadness"),
    words("flat", "low", "sad", "grieving", "despairing"),
    blanks(5),
    band("Joy"),
    words("content", "pleased", "glad", "delighted", "elated"),
    blanks(5),
    band("Shame"),
    words("awkward", "self-conscious", "embarrassed", "ashamed", "mortified"),
    blanks(5),
  ],
  footnote:
    "Point at a word instead of arguing about it. The ladder widens the vocabulary; it does not score anyone, and no column is the right one to be in. The blank line under each group is for the words this house actually uses.",
};

export const NEWCOMER_DIARY_TABLE: FigureTableSpec = {
  kind: "table",
  caption: "Day journal — one page, one day",
  fontSize: 15,
  columns: [
    { title: "Time", weight: 0.6 },
    { title: "What happened", weight: 1.5 },
    { title: "What I felt", weight: 1.1 },
    { title: "What I did", weight: 1.2 },
    { title: "What I'd do differently", weight: 1.5 },
  ],
  rows: [
    blanks(5),
    blanks(5),
    blanks(5),
    blanks(5),
    blanks(5),
    blanks(5),
    blanks(5),
    blanks(5),
    blanks(5),
    {
      type: "cells",
      cells: [
        { text: "Signed", bold: true, align: "left" },
        { text: "" },
        { text: "" },
        { text: "Date", bold: true, align: "left" },
        { text: "" },
      ],
    },
  ],
  footnote:
    "Fill it in the same evening, while the day is still yours to remember. Nobody marks the spelling. The last column is the only one that has to be honest.",
};

export const CHORES_ROTA_TABLE: FigureTableSpec = {
  kind: "table",
  caption: "Weekly chores rota",
  fontSize: 15,
  columns: [
    { title: "Area", weight: 1.5 },
    { title: "Monday", weight: 1 },
    { title: "Tuesday", weight: 1 },
    { title: "Wednesday", weight: 1 },
    { title: "Thursday", weight: 1 },
    { title: "Friday", weight: 1 },
    { title: "Saturday", weight: 1 },
    { title: "Sunday", weight: 1 },
  ],
  rows: [
    band("Inside"),
    words("Kitchen", "", "", "", "", "", "", ""),
    words("Dining room", "", "", "", "", "", "", ""),
    words("Common room", "", "", "", "", "", "", ""),
    words("Bathrooms", "", "", "", "", "", "", ""),
    words("Laundry", "", "", "", "", "", "", ""),
    band("Outside and shared"),
    words("Yard and bins", "", "", "", "", "", "", ""),
    words("Hall and stairs", "", "", "", "", "", "", ""),
    words("Store room", "", "", "", "", "", "", ""),
    {
      type: "cells",
      cells: [
        { text: "Checked by", bold: true, align: "left" },
        { text: "" },
        { text: "" },
        { text: "" },
        { text: "" },
        { text: "" },
        { text: "" },
        { text: "" },
      ],
    },
  ],
  footnote:
    "Names go up the evening before. A swap counts only when both names are changed on this sheet — an agreement in the corridor is not a swap, and the bottom row says who walked round and looked.",
};

export const HANDOVER_TABLE: FigureTableSpec = {
  kind: "table",
  caption: "Shift handover sheet",
  fontSize: 16,
  columns: [
    { title: "What to pass on", weight: 1.5 },
    { title: "Notes from this shift", weight: 2.1 },
    { title: "Who", weight: 0.7 },
    { title: "By when", weight: 0.7 },
  ],
  rows: [
    {
      type: "cells",
      cells: [
        { text: "Who is in the house, and who is away", align: "left" },
        { text: "" },
        { text: "" },
        { text: "" },
      ],
    },
    {
      type: "cells",
      cells: [{ text: "Who is unwell or needs watching", align: "left" }, { text: "" }, { text: "" }, { text: "" }],
    },
    {
      type: "cells",
      cells: [{ text: "What was promised, and by when", align: "left" }, { text: "" }, { text: "" }, { text: "" }],
    },
    {
      type: "cells",
      cells: [{ text: "What broke, ran out, or needs buying", align: "left" }, { text: "" }, { text: "" }, { text: "" }],
    },
    {
      type: "cells",
      cells: [{ text: "What the next shift has to decide", align: "left" }, { text: "" }, { text: "" }, { text: "" }],
    },
    band("Signatures"),
    {
      type: "cells",
      cells: [
        { text: "Handed over by", bold: true, align: "left" },
        { text: "" },
        { text: "Received by", bold: true, align: "left" },
        { text: "" },
      ],
    },
  ],
  footnote:
    "Write it during the shift, not at the door. A promise made to a resident is a promise from the house, so it travels with this sheet rather than with the consultant who made it.",
};

export const WARNING_SIGNS_TABLE: FigureTableSpec = {
  kind: "table",
  caption: "Noticed, done, not done",
  columns: [
    { title: "What you noticed", weight: 1.05 },
    { title: "What the consultant does", weight: 1.1 },
    { title: "What not to do", weight: 0.85 },
  ],
  rows: [
    words(
      "Skips the morning circle two days running.",
      "Asks, in private, what got in the way, and writes the answer down.",
      "Bring it up in front of the group.",
    ),
    words(
      "Stops eating with everyone and keeps to the room.",
      "Sits with them at one meal and offers a short walk.",
      "Leave it for the next shift to notice.",
    ),
    words(
      "Money or belongings go missing from a shared room.",
      "Notes what and when, and tells the senior consultant the same day.",
      "Search anyone's things or accuse a person in the hallway.",
    ),
    words(
      "Long calls that stop when someone walks in.",
      "Repeats the house rule on phones out loud, to everyone.",
      "Read their messages or take the phone away.",
    ),
    words(
      "Comes back from a work placement late twice in a week.",
      "Asks for the route and the times in writing, and agrees a check-in call.",
      "Threaten discharge in the middle of an argument.",
    ),
    words(
      "Gives belongings away and settles small debts quickly.",
      "Asks directly what they are planning for the coming week.",
      "Read it as progress and say nothing.",
    ),
    words(
      "Says the programme is pointless and the plan changes tomorrow.",
      "Writes the sentence down as it was said and hands it to the next shift.",
      "Argue about whether the programme works.",
    ),
    words(
      "Does not come back at the agreed time and does not answer.",
      "Follows the house procedure for an unplanned absence.",
      "Wait until morning before telling anyone.",
    ),
  ],
  footnote:
    "Record what was seen and heard — a time, a place, an action. Naming a cause is not this table's job and not the consultant's; the note goes to the senior consultant the same day, and the decision is made there.",
};

export const NEEDS_PYRAMID: FigurePyramidSpec = {
  kind: "pyramid",
  caption: "Where the weekly check-in starts",
  levels: [
    { title: "Sleep and food", detail: "did they sleep this week, and did they eat today" },
    { title: "Safety and money", detail: "a door that locks and enough to reach the next payday" },
    { title: "A shape to the day", detail: "an hour to get up, work to go to, chores that are theirs" },
    { title: "People", detail: "someone to call who is not a consultant" },
    { title: "Meaning and plans", detail: "a reason to keep going that belongs to them" },
  ],
};

export const CIRCLE_CARDS: FigureCardsSpec = {
  kind: "cards",
  caption: "Opening the circle: what to say, what to hold back",
  cards: [
    {
      title: "What the facilitator says",
      paragraphs: [
        "Short sentences, said much the same way every morning. The circle starts on time whether or not the room is awake.",
      ],
      bullets: [
        "Good morning. We start at eight, and we start with whoever is here.",
        "One voice at a time. If you are not speaking, you are listening.",
        "Your name, then one sentence: how you slept and how you are.",
        "If you would rather not speak, say 'pass'. Nobody is asked twice.",
        "Chores are read out at the end, not argued about at the start.",
      ],
      tail: ["Close by naming what happens next and at what time."],
    },
    {
      title: "What the circle is not for",
      paragraphs: ["These belong somewhere — just not here. Name where they go, then move on."],
      bullets: [
        "Complaints about another resident — a one-to-one, the same day.",
        "Asks for phone time, money, or leave — the duty consultant, after breakfast.",
        "Anyone's health — staff, in private, never across the circle.",
        "Long accounts of the past — the journaling group has the time for them.",
        "Decisions about how the house is run — the house meeting.",
      ],
    },
  ],
};
