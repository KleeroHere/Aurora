export type TourKeyAction = "close" | "next" | "prev" | null;

export function tourKeyAction(key: string, onControl: boolean): TourKeyAction {
  if (key === "Escape") return "close";
  if (key === "ArrowRight") return "next";
  if (key === "ArrowLeft") return "prev";
  if (key === "Enter" && !onControl) return "next";
  return null;
}
