import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useContentIndex } from "../../data/useContentIndex";
import Accordion from "../Accordion/Accordion";
import SearchInput from "../SearchInput/SearchInput";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import SidebarSkeleton from "./SidebarSkeleton";
import SyncPulseIndicator from "../SyncPulseIndicator/SyncPulseIndicator";
import { brandIdentity } from "../../context/brandIdentity";
import { useTheme } from "../../context/ThemeContext";
import "./Sidebar.css";

export default function Sidebar() {
  const { sectionGroups, loading } = useContentIndex();
  const [query, setQuery] = useState("");
  const { palette } = useTheme();
  const identity = brandIdentity(palette);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sectionGroups
      .map(({ section, materials }) => ({
        section,
        materials: materials.filter((material) => !q || material.title.toLowerCase().includes(q)),
      }))
      .filter((group) => !q || group.materials.length > 0);
  }, [sectionGroups, query]);

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <Link
          to="/"
          className="sidebar__identity"
          title={identity.title}
          data-help="sidebar-identity"
        >
          <img src={identity.mark} alt="" className="sidebar__identity-mark" />
          <span className="sidebar__identity-name">{identity.name}</span>
        </Link>
        <ThemeToggle />
      </div>
      <div className="sidebar__logos-divider" aria-hidden="true" />

      <div className="sidebar__search" data-help="sidebar-search">
        <SearchInput value={query} onChange={setQuery} placeholder="Find a section or material" />
      </div>

      <nav className="sidebar__nav" aria-label="Sections" data-help="sidebar-nav">
        {loading ? (
          <SidebarSkeleton />
        ) : groups.length === 0 ? (
          <p className="sidebar__hint">Nothing found.</p>
        ) : (
          <Accordion groups={groups} forceExpandAll={query.trim().length > 0} />
        )}
      </nav>

      <div className="sidebar__footer-divider" aria-hidden="true" />
      <div className="sidebar__footer">
        <Link to="/admin" className="sidebar__aurora-link" title="Aurora admin" data-help="sidebar-admin-link">
          <img src={identity.auroraMark} alt="Aurora" className="sidebar__aurora-mark" />
        </Link>
      </div>
      <SyncPulseIndicator />
    </aside>
  );
}
