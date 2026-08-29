import { SkeletonBlock } from "../Skeleton/Skeleton";
import "./MaterialCardSkeleton.css";

export default function MaterialCardSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="material-card-skeleton" data-wide={wide} aria-hidden="true">
      <SkeletonBlock className="material-card-skeleton__cover" />
      <div className="material-card-skeleton__body">
        <SkeletonBlock className="material-card-skeleton__title" />
        <SkeletonBlock className="material-card-skeleton__title material-card-skeleton__title--short" />
        <SkeletonBlock className="material-card-skeleton__meta" />
      </div>
    </div>
  );
}
