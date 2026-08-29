import {
  CHORES_ROTA_TABLE,
  CIRCLE_CARDS,
  FEELINGS_TABLE,
  HANDOVER_TABLE,
  NEEDS_PYRAMID,
  NEWCOMER_DIARY_TABLE,
  WARNING_SIGNS_TABLE,
} from "./figureData";
import type { FigureSpec } from "./figureTypes";

export interface MaterialFigureEntry {
  spec: FigureSpec;
  orientation: "portrait" | "landscape";
}

export const MATERIAL_FIGURES: Record<string, MaterialFigureEntry> = {
  "article:intake__naming-feelings": { spec: FEELINGS_TABLE, orientation: "portrait" },
  "article:programme__opening-the-morning-circle": { spec: CIRCLE_CARDS, orientation: "portrait" },
  "article:programme__the-chores-rota": { spec: CHORES_ROTA_TABLE, orientation: "landscape" },
  "article:programme__journaling-groups": { spec: NEWCOMER_DIARY_TABLE, orientation: "landscape" },
  "article:night-shift__handover-between-shifts": { spec: HANDOVER_TABLE, orientation: "landscape" },
  "article:crisis__suspected-relapse": { spec: WARNING_SIGNS_TABLE, orientation: "portrait" },
  "article:aftercare__aftercare-check-ins": { spec: NEEDS_PYRAMID, orientation: "portrait" },
};

export function findMaterialFigure(materialId: string): MaterialFigureEntry | null {
  return MATERIAL_FIGURES[materialId] ?? null;
}
