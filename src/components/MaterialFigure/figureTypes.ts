
export interface FigureCell {
  text: string;
  rowSpan?: number;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center";
  head?: boolean;
}

export type FigureRow =
  | { type: "cells"; cells: FigureCell[] }
  | { type: "band"; text: string };

export interface FigureColumn {
  title: string;
  weight: number;
}

export interface FigureTableSpec {
  kind: "table";
  caption: string;
  columns: FigureColumn[];
  rows: FigureRow[];
  footnote?: string;
  fontSize?: number;
  headless?: boolean;
}

export interface FigurePyramidSpec {
  kind: "pyramid";
  caption: string;
  levels: { title: string; detail: string }[];
}

export interface FigureCardsSpec {
  kind: "cards";
  caption: string;
  cards: {
    title: string;
    paragraphs: string[];
    bullets?: string[];
    tail?: string[];
  }[];
}

export type FigureSpec = FigureTableSpec | FigurePyramidSpec | FigureCardsSpec;
