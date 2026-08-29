import { SkeletonBlock } from "../Skeleton/Skeleton";
import "./SidebarSkeleton.css";

const ROW_WIDTHS = [78, 55, 68, 45, 82, 60];

export default function SidebarSkeleton() {
  return (
    <div className="sidebar-skeleton" aria-hidden="true">
      {ROW_WIDTHS.map((width, i) => (
        <div key={i} className="sidebar-skeleton__row">
          <SkeletonBlock className="sidebar-skeleton__chevron" />
          <SkeletonBlock className="sidebar-skeleton__title" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  );
}
