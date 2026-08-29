import { fnv1a32 } from "./seededRandom";
import { ILLUSTRATIONS_BY_THEME } from "./coverIllustrationAssets";

type Theme = string;

const RULES: ReadonlyArray<readonly [Theme, readonly string[]]> = [
  ["zaschita", ["prevent", "protect", "safet", "secur"]],
  ["kuhnya", ["kitchen", "food", "meal", "nutrition", "grocer", "towel"]],
  ["dnevnik", ["diary", "daily"]],
  ["tetrad", ["notebook"]],
  ["zhurnal", ["journal", "logbook"]],

  ["blank", ["form", "statement", "contract", "questionnaire", "card", "appendix", "passport", "badge", "press"]],
  ["dokument", ["document", "file", "report", "regulation", "certificat", "disciplin", "sheet"]],
  ["zadanie", ["assignment", "task", "exercise", "workbook", "handbook"]],

  ["pismo", ["letter", "call", "chat", "phone", "mail", "advertis"]],
  ["semya", ["famil", "relative", "parent", "loved"]],
  ["razgovor", ["conversation", "talk", "message", "communicat", "script", "consult"]],
  ["gruppa", ["group", "circle", "meeting", "training", "session", "debrief"]],
  ["chelovek", ["client", "newcomer", "personal", "profile", "intake"]],
  ["pomosch", ["help", "support", "acceptance", "readiness", "kindness"]],

  ["sryv", ["crisis", "relapse", "craving", "urge", "tension"]],
  ["serdce", ["love", "feeling", "emotion"]],
  ["chuvstva", ["thought", "mindful", "awareness", "mood", "reaction"]],
  ["zdorove", ["illness", "disease", "treatment", "recovery", "syndrome", "medic", "temperature", "hygiene", "health"]],
  ["vopros", ["question", "problem", "resistance", "honest", "matur", "laziness"]],

  ["uborka", ["cleaning", "clean", "laundry", "repair", "stationer", "tidy"]],
  ["dezhurstvo", ["schedule", "shift", "roster", "duty", "weekly"]],
  ["vremya", ["time", "day", "evening", "morning", "recap", "opening"]],
  ["plan", ["plan", "goal", "motivation"]],
  ["analiz", ["analysis", "table", "tracking", "control", "check", "counter", "statistic"]],
  ["pravila", ["rule", "charter", "ethic", "violation", "norm", "requirement"]],
  ["ruki", ["responsibilit", "obligation", "labor", "worker", "job"]],

  ["obuchenie", ["learning", "exam", "lecturer", "consultant", "trainee", "onboard"]],
  ["lekciya", ["lecture", "seminar", "concept", "aspect", "stage", "phase", "level", "process"]],
  ["prezentaciya", ["presentation", "diagram", "slide"]],
  ["film", ["film", "movie", "screening"]],
  ["dom", ["center", "apartment", "room", "premises", "office"]],
  ["put", ["path", "step", "journey", "milestone"]],
  ["priroda", ["walk", "nature", "outdoor", "spiritual", "sunday"]],
  ["son", ["sleep", "rest", "vacation"]],
  ["sport", ["activ", "sport", "physical", "skill"]],
];

export function coverThemeFor(title: string): Theme | null {
  const words = title
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

  for (const [theme, stems] of RULES) {
    for (const stem of stems) {
      if (words.some((word) => word.startsWith(stem))) return theme;
    }
  }
  return null;
}

export function coverIllustrationFor(title: string, materialId: string): string | null {
  const theme = coverThemeFor(title);
  if (!theme) return null;
  const files = ILLUSTRATIONS_BY_THEME[theme];
  if (!files || files.length === 0) return null;
  return files[fnv1a32(`illustration:${materialId}`) % files.length];
}
