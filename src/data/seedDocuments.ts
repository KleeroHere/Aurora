import type { PdfDocumentSpec } from "./documentPdf";

// The actual page layout of every seeded form and slide deck, keyed by the
// material's nameSlugSource. What the sheet says lives in seedData (fileLines,
// which also feeds the search index); how it looks on paper lives here.

export const SEED_DOCUMENTS: Record<string, PdfDocumentSpec> = {
  "Intake checklist": {
    kind: "form",
    title: "Intake checklist",
    subtitle: "Filled in on the day of arrival. Keep in the resident's folder.",
    intro: [
      "Work through the list top to bottom during the first hour. Every line is",
      "either completed or crossed out with a reason - nothing is left blank.",
    ],
    fields: [
      { label: "Resident name" },
      { label: "Date and time of arrival" },
      { label: "Emergency contact: name, relationship, phone" },
      { label: "People who must NOT be contacted", lines: 2 },
      { label: "Bed and room assigned" },
    ],
    checkboxes: [
      "Belongings inventory completed and signed by both parties",
      "House agreement read together and signed",
      "Bed, bathroom and common areas shown",
      "First meal offered",
      "Night shift informed by name",
    ],
    signatures: ["Consultant on duty", "Resident"],
    footer: "Aurora demo - fictional form",
  },

  "House agreement": {
    kind: "form",
    title: "House agreement",
    subtitle: "Read together on day two. One copy to the resident, one to the folder.",
    intro: [
      "This agreement is read aloud, together, unhurried. Questions are welcome",
      "at any line - a rule that was not understood was not agreed to.",
    ],
    checkboxes: [
      "Nothing that alters my state comes through the door.",
      "No violence and no threats, in any direction.",
      "I attend the morning circle, meals and group sessions.",
      "I do the duties listed on the rota for my name.",
      "Phones and visits follow the posted schedule.",
      "Lights out is lights out.",
    ],
    fields: [{ label: "Questions discussed before signing", lines: 3 }],
    signatures: ["Resident", "Consultant on duty"],
    footer: "Aurora demo - fictional form",
  },

  "Orientation for new residents": {
    kind: "slides",
    title: "Orientation for new residents",
    subtitle: "The first-week talk, given on day two",
    slides: [
      {
        heading: "Welcome - how the first week works",
        bullets: [
          "The first days are for arriving, not achieving",
          "One person answers your questions today - ask them anything",
          "Nobody expects you to know the rhythm yet",
        ],
      },
      {
        heading: "The day has a shape",
        bullets: [
          "Morning circle - everyone, seated, twenty minutes",
          "Chores by the rota on the board",
          "Group in the afternoon, quiet hour before it",
          "Evening review closes the day",
        ],
      },
      {
        heading: "Calls and visits",
        bullets: [
          "Week 1-2: one call, staff present",
          "From week 3: calls and a visit in the common room",
          "The schedule is on the board - no favours needed",
        ],
      },
      {
        heading: "Who to ask",
        bullets: [
          "Anything about today - the duty consultant",
          "Anything about the programme - your consultant",
          "Anything about the house - the senior resident",
        ],
      },
    ],
    footer: "Aurora demo",
  },

  "Incident report": {
    kind: "form",
    title: "Incident report",
    subtitle: "Written the same shift, while details are exact.",
    intro: [
      "Facts and observations only. What you concluded belongs in the",
      "conversation with the lead, not on this sheet.",
    ],
    fields: [
      { label: "Date and time of the incident" },
      { label: "Who was present" },
      { label: "What happened, in order, observed only", lines: 5 },
      { label: "What the consultant did", lines: 3 },
      { label: "Who was informed, and when" },
      { label: "Follow-up agreed with the lead", lines: 2 },
    ],
    signatures: ["Consultant on duty"],
    footer: "Aurora demo - fictional form",
  },

  "De-escalation basics": {
    kind: "slides",
    title: "De-escalation basics",
    subtitle: "Staff training - twenty minutes",
    slides: [
      {
        heading: "Lower your voice before you raise your argument",
        bullets: [
          "Volume is contagious in both directions",
          "Slow your own breathing first - it shows",
          "Stand at an angle, never square on",
        ],
      },
      {
        heading: "Separate first, discuss later",
        bullets: [
          "Different rooms, a task each",
          "Nothing said mid-shout will be remembered",
          "Ask the room what happened before you ask either of them",
        ],
      },
      {
        heading: "Give a task, not an ultimatum",
        bullets: [
          "A task gives the person a way to climb down with dignity",
          "An ultimatum gives them an audience and a cliff",
        ],
      },
      {
        heading: "Afterwards",
        bullets: [
          "One at a time, calmer first",
          "The incident report is written the same shift",
          "Tell the handover - the evening belongs to the next consultant",
        ],
      },
    ],
    footer: "Aurora demo",
  },

  "Daily journal page": {
    kind: "form",
    title: "Daily journal page",
    subtitle: "One page a day. Read aloud in group twice a week - passing is free.",
    fields: [
      { label: "Date" },
      { label: "What happened today", lines: 4 },
      { label: "What I felt, in one word - see the feelings table if the word will not come" },
      { label: "What I did with the feeling", lines: 3 },
      { label: "What I will do differently tomorrow", lines: 2 },
    ],
    signatures: ["Written by"],
    footer: "Aurora demo - fictional form",
  },

  "Shift handover log": {
    kind: "form",
    title: "Shift handover log",
    subtitle: "Spoken and written - one without the other does not count.",
    fields: [
      { label: "Date / shift handed over at" },
      { label: "Who is in the house, who is away and where", lines: 2 },
      { label: "Anyone unwell, upset, or newly arrived", lines: 2 },
      { label: "Promises made, and by when", lines: 2 },
      { label: "What broke, ran out, or needs buying", lines: 2 },
      { label: "Decisions left to the next shift", lines: 2 },
    ],
    signatures: ["Handed over by", "Accepted by"],
    footer: "Aurora demo - fictional form",
  },

  "Food quality register": {
    kind: "form",
    title: "Food quality register",
    subtitle: "Filled in before each meal is served.",
    table: {
      headers: ["Date / meal", "Dish tasted", "Temp OK", "Portion OK", "Fit to serve", "Signature"],
      rows: 12,
    },
    footer: "Aurora demo - fictional form",
  },

  "Fridge temperature log": {
    kind: "form",
    title: "Fridge temperature log",
    subtitle: "Two readings a day, morning and evening.",
    table: {
      headers: ["Date", "Time", "Fridge #", "Reading", "In range", "Action if not", "Signature"],
      rows: 14,
    },
    footer: "Aurora demo - fictional form",
  },

  "Rules for the first week": {
    kind: "slides",
    title: "Rules for the first week",
    subtitle: "Shown during orientation, day two",
    slides: [
      {
        heading: "Why the first week is stricter",
        bullets: [
          "Structure carries you while motivation comes and goes",
          "Every rule below relaxes as the programme goes on",
        ],
      },
      {
        heading: "The non-negotiables",
        bullets: [
          "Nothing that alters your state comes through the door",
          "No violence and no threats, in any direction",
          "Lights out is lights out",
        ],
      },
      {
        heading: "The daily ones",
        bullets: [
          "Circle, meals and group - everyone, every day",
          "Chores by the rota, swaps agreed before the circle",
          "Calls and visits by the posted schedule",
        ],
      },
      {
        heading: "If a rule feels unfair",
        bullets: [
          "Say so - at the house meeting, not at the door",
          "Rules change by agreement, never by exception",
        ],
      },
    ],
    footer: "Aurora demo",
  },

  "Running your first group": {
    kind: "slides",
    title: "Running your first group",
    subtitle: "For new facilitators - read before, not during",
    slides: [
      {
        heading: "Before the room fills",
        bullets: [
          "Chairs in one ring - no second row, no desk",
          "One question chosen and written down",
          "A clock you can see without turning your head",
        ],
      },
      {
        heading: "Open the same way every time",
        bullets: [
          "Ritual lowers the temperature",
          "Name the question, name the timing, name that passing is free",
        ],
      },
      {
        heading: "Your job is the frame, not the content",
        bullets: [
          "Three minutes a person, kept openly and kindly",
          "No advice unless the speaker asks for it",
          "You answer the question too - last, and briefly",
        ],
      },
      {
        heading: "Close on time",
        bullets: [
          "Even mid-sentence, gently - the frame is the therapy",
          "Find anyone the session shook - within the hour, one to one",
        ],
      },
    ],
    footer: "Aurora demo",
  },

  "Family visit agreement": {
    kind: "form",
    title: "Family visit agreement",
    subtitle: "Read and signed before the first visit. One copy to the visitor.",
    fields: [
      { label: "Visitor name and relationship to the resident" },
      { label: "Date and agreed hours of the visit" },
    ],
    checkboxes: [
      "Bags and gifts are handed to staff on arrival.",
      "The visit takes place in the common room.",
      "I will end the visit if staff ask, without discussion at the door.",
      "Nothing that alters one's state may be brought onto the grounds.",
      "What my relative shares with me during the visit stays between us.",
    ],
    signatures: ["Visitor", "Consultant on duty"],
    footer: "Aurora demo - fictional form",
  },
};
