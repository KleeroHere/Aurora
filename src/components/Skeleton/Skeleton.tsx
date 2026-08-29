import type { CSSProperties } from "react";
import "./Skeleton.css";

export function SkeletonBlock({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton-block ${className}`.trim()} style={style} aria-hidden="true" />;
}
