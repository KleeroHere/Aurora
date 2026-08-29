import { fnv1a32 } from "./seededRandom";
import bevelCircle from "../assets/patterns/bevel-circle.svg";
import bubbles from "../assets/patterns/bubbles.svg";
import churchOnSunday from "../assets/patterns/church-on-sunday.svg";
import connections from "../assets/patterns/connections.svg";
import current from "../assets/patterns/current.svg";
import diagonalLines from "../assets/patterns/diagonal-lines.svg";
import endlessClouds from "../assets/patterns/endless-clouds.svg";
import fourPointStars from "../assets/patterns/four-point-stars.svg";
import graphPaper from "../assets/patterns/graph-paper.svg";
import heavyRain from "../assets/patterns/heavy-rain.svg";
import hexagons from "../assets/patterns/hexagons.svg";
import intersectingCircles from "../assets/patterns/intersecting-circles.svg";
import leaf from "../assets/patterns/leaf.svg";
import linesInMotion from "../assets/patterns/lines-in-motion.svg";
import melt from "../assets/patterns/melt.svg";
import moroccan from "../assets/patterns/moroccan.svg";
import overlappingCircles from "../assets/patterns/overlapping-circles.svg";
import overlappingHexagons from "../assets/patterns/overlapping-hexagons.svg";
import plus from "../assets/patterns/plus.svg";
import polkaDots from "../assets/patterns/polka-dots.svg";
import rain from "../assets/patterns/rain.svg";
import temple from "../assets/patterns/temple.svg";
import texture from "../assets/patterns/texture.svg";
import tinyCheckers from "../assets/patterns/tiny-checkers.svg";
import topography from "../assets/patterns/topography.svg";
import wiggle from "../assets/patterns/wiggle.svg";
import zigZag from "../assets/patterns/zig-zag.svg";

export const COVER_PATTERNS: readonly string[] = [
  bevelCircle, bubbles, churchOnSunday, connections, current,
  diagonalLines, endlessClouds, fourPointStars, graphPaper, heavyRain,
  hexagons, intersectingCircles, leaf, linesInMotion, melt, moroccan,
  overlappingCircles, overlappingHexagons, plus, polkaDots, rain, temple,
  texture, tinyCheckers, topography, wiggle, zigZag,
];

export function coverPatternFor(materialId: string): string {
  return COVER_PATTERNS[fnv1a32(`cover:${materialId}`) % COVER_PATTERNS.length];
}

export function coverToneFor(materialId: string): number {
  return fnv1a32(`tone:${materialId}`) % 4;
}
