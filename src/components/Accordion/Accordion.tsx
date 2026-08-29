import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { MaterialSummary, Section } from "../../data/types";
import "./Accordion.css";

export interface AccordionGroup {
  section: Section;
  materials: MaterialSummary[];
}

interface AccordionProps {
  groups: AccordionGroup[];
  forceExpandAll?: boolean;
}

export interface PillRect {
  top: number;
  left: number;
  height: number;
  scaleX: number;
  visible: boolean;
}

export interface RectLike {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const HIDDEN_PILL: PillRect = { top: 0, left: 0, height: 0, scaleX: 0, visible: false };

export function computePillRect(containerRect: RectLike, activeRect: RectLike): PillRect {
  const trackWidth = containerRect.width;
  return {
    top: activeRect.top - containerRect.top,
    left: activeRect.left - containerRect.left,
    height: activeRect.height,
    scaleX: trackWidth > 0 ? activeRect.width / trackWidth : 0,
    visible: true,
  };
}

export default function Accordion({ groups, forceExpandAll = false }: AccordionProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<PillRect>(HIDDEN_PILL);
  const location = useLocation();

  const activeSectionId = useMemo(() => {
    const sectionMatch = location.pathname.match(/^\/section\/(.+)$/);
    if (sectionMatch) return decodeURIComponent(sectionMatch[1]);
    const materialMatch = location.pathname.match(/^\/material\/(.+)$/);
    if (materialMatch) {
      const materialId = decodeURIComponent(materialMatch[1]);
      const group = groups.find((g) => g.materials.some((m) => m._id === materialId));
      return group?.section._id ?? null;
    }
    return null;
  }, [location.pathname, groups]);

  useEffect(() => {
    if (!activeSectionId) return;
    setOpenSections((prev) => (prev.has(activeSectionId) ? prev : new Set(prev).add(activeSectionId)));
  }, [activeSectionId]);

  function toggle(sectionId: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function measure() {
      const active = container!.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active) {
        setPill((prev) => (prev.visible ? HIDDEN_PILL : prev));
        return;
      }
      const containerRect = container!.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      setPill(computePillRect(containerRect, activeRect));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [groups, openSections, forceExpandAll, location.pathname]);

  return (
    <div className="accordion" ref={containerRef}>
      <div
        className="accordion__active-pill"
        aria-hidden="true"
        data-visible={pill.visible}
        style={{
          transform: `translate(${pill.left}px, ${pill.top}px) scaleX(${pill.scaleX})`,
          height: pill.height ? `${pill.height}px` : undefined,
        }}
      />
      <ul className="accordion__sections">
      {groups.map(({ section, materials }) => {
        const isOpen = forceExpandAll || openSections.has(section._id);
        return (
          <li
            key={section._id}
            className="accordion__item"
            data-nested={section.parentId !== null}
          >
            <div className="accordion__header">
              <button
                type="button"
                className="accordion__toggle"
                aria-expanded={isOpen}
                aria-controls={`accordion-panel-${section._id}`}
                onClick={() => toggle(section._id)}
              >
                <span className="accordion__chevron" data-open={isOpen} aria-hidden="true" />
              </button>
              <NavLink
                to={`/section/${encodeURIComponent(section._id)}`}
                className={({ isActive }) =>
                  isActive ? "accordion__title accordion__title--active" : "accordion__title"
                }
              >
                {section.title}
              </NavLink>
              <span className="accordion__count">{materials.length}</span>
            </div>
            <div id={`accordion-panel-${section._id}`} className="accordion__panel" data-open={isOpen}>
              <ul className="accordion__list">
                {materials.map((material) => (
                  <li key={material._id}>
                    <NavLink
                      to={`/material/${encodeURIComponent(material._id)}`}
                      className={({ isActive }) =>
                        isActive
                          ? "accordion__link accordion__link--active"
                          : "accordion__link"
                      }
                    >
                      {material.title}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        );
      })}
      </ul>
    </div>
  );
}
