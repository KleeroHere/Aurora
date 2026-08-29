import { SkeletonBlock } from "../components/Skeleton/Skeleton";
import "./MaterialPageSkeleton.css";

export default function MaterialPageSkeleton() {
  return (
    <div className="material-page material-page-skeleton" aria-hidden="true">
      <SkeletonBlock className="material-page-skeleton__breadcrumb" />
      <SkeletonBlock className="material-page-skeleton__title" />
      <SkeletonBlock className="material-page-skeleton__meta" />
      <div className="material-page-skeleton__body">
        <SkeletonBlock className="material-page-skeleton__line" />
        <SkeletonBlock className="material-page-skeleton__line" />
        <SkeletonBlock className="material-page-skeleton__line material-page-skeleton__line--short" />
      </div>
    </div>
  );
}
