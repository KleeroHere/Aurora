import { SkeletonBlock } from "../Skeleton/Skeleton";
import "./SectionCardSkeleton.css";

export default function SectionCardSkeleton() {
  return (
    <div className="section-card-skeleton" aria-hidden="true">
      <SkeletonBlock className="section-card-skeleton__title" />
      <SkeletonBlock className="section-card-skeleton__count" />
    </div>
  );
}
