import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSections } from "../../data/repository";
import type { MaterialSummary, Section } from "../../data/types";
import SearchInput from "../SearchInput/SearchInput";
import UserAvatar from "../UserAvatar/UserAvatar";
import HelpButton from "../HelpButton/HelpButton";
import TagChip from "../TagChip/TagChip";
import { orderTagsForDisplay } from "../../utils/tagColor";
import { useLiveSearch } from "../../utils/useLiveSearch";
import { findHighlight, matchReasonLabel } from "../../utils/searchHighlight";
import { MATERIAL_TYPE_LABELS } from "../../data/materialTypeLabels";
import { useEmergencyMode } from "../../context/EmergencyModeContext";
import Icon from "../icons/Icon";
import "./TopBar.css";

// Emergency mode jumps straight to the section holding the crisis protocols —
// the one thing nobody should have to search for at three in the morning.
const EMERGENCY_SECTION_TITLE = "Crisis situations";

const COMPACT_SCROLL_THRESHOLD = 24;

/**
 * The margin above the threshold that must survive compacting. Without it a
 * page with exactly enough room sits right on the boundary and shudders from
 * a single pixel.
 */
const COMPACT_ROOM_MARGIN = 8;

/** How much shorter the bar gets when compact — read from CSS, not guessed. */
function compactDelta(el: HTMLElement): number {
  const raw = getComputedStyle(el).getPropertyValue("--topbar-compact-delta");
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 16;
}

function useCompactOnScroll(elementRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scrollEl = document.querySelector<HTMLElement>(".app-layout__main");
    if (!scrollEl) return;

    let ticking = false;
    /**
     * Compacting does not always kick in, and that is not fussiness — a short
     * article would otherwise make the bar visibly shudder.
     *
     * The bar is sticky but still takes up room in the flow, so compacting
     * makes the page `--topbar-compact-delta` shorter. If there was barely
     * anything to scroll, the shortened page no longer reaches the current
     * `scrollTop`, the browser pushes it down — the scroll drops below the
     * threshold, the class comes off, the height returns, and it repeats. With
     * the padding animated this runs continuously and looks like shaking.
     *
     * The cure is a one-sided check: only turn compacting ON if there will
     * still be somewhere to scroll past the threshold afterwards. Removing the
     * class makes the page longer and cannot clamp the scroll, so the reverse
     * transition needs no check — and must not be measured mid-animation,
     * where the height is somewhere in between.
     */
    function update() {
      ticking = false;
      const el = elementRef.current;
      if (!el) return;
      const alreadyCompact = el.classList.contains("topbar--compact");

      if (alreadyCompact) {
        if (scrollEl!.scrollTop <= COMPACT_SCROLL_THRESHOLD) el.classList.remove("topbar--compact");
        return;
      }

      const roomExpanded = scrollEl!.scrollHeight - scrollEl!.clientHeight;
      const roomAfterCompacting = roomExpanded - compactDelta(el);
      if (roomAfterCompacting <= COMPACT_SCROLL_THRESHOLD + COMPACT_ROOM_MARGIN) return;
      if (scrollEl!.scrollTop > COMPACT_SCROLL_THRESHOLD) el.classList.add("topbar--compact");
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    update();
    scrollEl.addEventListener("scroll", onScroll);
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [elementRef]);
}

const DROPDOWN_LIMIT = 8;

export default function TopBar({ onOpenNav }: { onOpenNav?: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, isTagQuery, suggestions } = useLiveSearch(query);
  const [sections, setSections] = useState<Section[]>([]);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const topbarRef = useRef<HTMLElement>(null);
  const { emergencyMode, enterEmergencyMode, exitEmergencyMode } = useEmergencyMode();

  useCompactOnScroll(topbarRef);

  useEffect(() => {
    getSections().then(setSections);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const sectionTitles = Object.fromEntries(sections.map((s) => [s._id, s.title]));
  const emergencySection = sections.find((s) => s.title === EMERGENCY_SECTION_TITLE);
  const emergencySectionPath = emergencySection
    ? `/section/${encodeURIComponent(emergencySection._id)}`
    : null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleResults = results.slice(0, DROPDOWN_LIMIT);
  const hiddenCount = results.length - visibleResults.length;

  function openMaterial(material: MaterialSummary) {
    setQuery("");
    setActiveIndex(-1);
    navigate(`/material/${encodeURIComponent(material._id)}`);
  }

  function openAllResults() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setQuery("");
    setActiveIndex(-1);
    navigate(`/search/${encodeURIComponent(trimmed)}`);
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1 >= visibleResults.length ? -1 : i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 < -1 ? visibleResults.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && visibleResults[activeIndex]) openMaterial(visibleResults[activeIndex].summary);
      else openAllResults();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setQuery("");
      setActiveIndex(-1);
    }
  }

  if (emergencyMode) {
    return (
      <header className="topbar topbar--emergency" ref={topbarRef}>
        <span className="topbar__emergency-label">Emergency mode</span>
        <button type="button" className="topbar__emergency-exit" onClick={exitEmergencyMode}>
          Exit emergency mode
        </button>
      </header>
    );
  }

  return (
    <header className="topbar" ref={topbarRef}>
      <button
        type="button"
        className="topbar__nav-toggle"
        aria-label="Open the sections menu"
        onClick={onOpenNav}
      >
        <Icon name="menu" />
      </button>
      <div className="topbar__search" ref={containerRef} data-help="topbar-search">
        <SearchInput
          ref={inputRef}
          value={query}
          onChange={(value) => {
            setQuery(value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleSearchKeyDown}
          placeholder="Search all materials (Ctrl+K)"
          aria-controls="topbar-search-results"
          aria-expanded={query.trim().length > 0}
          aria-activedescendant={activeIndex >= 0 ? `topbar-result-${activeIndex}` : undefined}
        />
        {query.trim().length > 0 && (
          <ul className="topbar__results surface-glass-blur" id="topbar-search-results" role="listbox">
            {isTagQuery && (
              <li className="topbar__hint">Tag search — start the line with #, for example #crisis</li>
            )}
            {results.length === 0 && (
              <li className="topbar__empty">
                <p>Nothing found.</p>
                {isTagQuery ? (
                  <button type="button" className="topbar__empty-button" onClick={() => setQuery("")}>
                    Clear the tag search
                  </button>
                ) : (
                  <>
                    <button type="button" className="topbar__empty-button" onClick={() => setQuery("")}>
                      Clear the search
                    </button>
                    {suggestions.length > 0 && (
                      <p className="topbar__suggestions">
                        Did you mean:{" "}
                        {suggestions.map((s, i) => (
                          <span key={s}>
                            <button type="button" className="topbar__suggestion" onClick={() => setQuery(s)}>
                              {s}
                            </button>
                            {i < suggestions.length - 1 && ", "}
                          </span>
                        ))}
                      </p>
                    )}
                  </>
                )}
              </li>
            )}
            {visibleResults.map(({ summary, matchedFields }, index) => {
              const leadingTag = orderTagsForDisplay(summary.tags)[0];
              const reason = matchReasonLabel(matchedFields);
              const highlight = findHighlight(summary.title, query);
              return (
                <li
                  key={summary._id}
                  id={`topbar-result-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={"topbar__result" + (index === activeIndex ? " topbar__result--active" : "")}
                  onClick={() => openMaterial(summary)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className="topbar__result-title">
                    {highlight ? (
                      <>
                        {highlight.before}
                        <mark className="search-highlight">{highlight.match}</mark>
                        {highlight.after}
                      </>
                    ) : (
                      summary.title
                    )}
                  </span>
                  {leadingTag && <TagChip tag={leadingTag} interactive={false} />}
                  {summary.type !== "article" && (
                    <span className="topbar__result-type">{MATERIAL_TYPE_LABELS[summary.type]}</span>
                  )}
                  {summary.video && <span className="topbar__result-type">video</span>}
                  <Link
                    className="topbar__result-section"
                    to={`/section/${encodeURIComponent(summary.sectionId)}`}
                    onClick={(event) => event.stopPropagation()}
                    title="Open the whole section"
                  >
                    {sectionTitles[summary.sectionId] ?? summary.sectionId}
                  </Link>
                  {reason && <span className="topbar__result-reason">{reason}</span>}
                </li>
              );
            })}
            {results.length > 0 && (
              <li className="topbar__more">
                <button type="button" className="topbar__more-button" onClick={openAllResults}>
                  {hiddenCount > 0
                    ? `Show all ${results.length} — Enter`
                    : "Open as a list — Enter"}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
      <div className="topbar__right">
        {emergencySection && emergencySectionPath && (
          <Link
            to={emergencySectionPath}
            className="topbar__emergency-button"
            onClick={enterEmergencyMode}
            data-help="topbar-emergency"
          >
            <Icon name="warning" size={14} />
            <span>Emergency</span>
          </Link>
        )}
        <HelpButton />
        <Link
          to="/settings"
          className="topbar__settings-link"
          title="Settings"
          aria-label="Settings"
          data-help="topbar-settings"
        >
          <Icon name="settings" size={22} />
        </Link>
        <UserAvatar />
      </div>
    </header>
  );
}
