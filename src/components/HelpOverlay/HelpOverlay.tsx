import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { tourKeyAction } from "../../help/tourKeys";
import { useHelp } from "../../help/HelpContext";
import { HELP_TOPICS, HELP_TOUR, isChromeTopic } from "../../help/helpContent";
import { SCREEN_TITLES, screenIdForPath } from "../../help/helpScreens";
import "./HelpOverlay.css";

interface Step {
  anchor: string | null;
  title: string;
  body: string;
  path?: string | null;
  group?: "content" | "chrome";
}

const CALLOUT_WIDTH = 380;
const CALLOUT_GAP = 18;
const CALLOUT_ESTIMATED_HEIGHT = 240;
const VIEWPORT_MARGIN = 16;
const SPOT_PADDING = 8;

function anchorElement(anchor: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-help="${CSS.escape(anchor)}"]`);
}

interface ScreenSteps {
  content: Step[];
  chrome: Step[];
}

function collectScreenSteps(pathname: string): ScreenSteps {
  const screen = screenIdForPath(pathname);
  const shown = HELP_TOPICS.filter((topic) => topic.screen === "global" || topic.screen === screen).filter(
    (topic) => anchorElement(topic.anchor) !== null,
  );

  const byOrder = (a: (typeof shown)[number], b: (typeof shown)[number]) => a.order - b.order;
  const toStep = (group: "content" | "chrome") => (topic: (typeof shown)[number]) => ({
    anchor: topic.anchor,
    title: topic.title,
    body: topic.body,
    group,
  });

  return {
    content: shown
      .filter((topic) => !isChromeTopic(topic.anchor))
      .sort(byOrder)
      .map(toStep("content")),
    chrome: shown
      .filter((topic) => isChromeTopic(topic.anchor))
      .sort(byOrder)
      .map(toStep("chrome")),
  };
}

interface Placement {
  left: number;
  top: number;
}

function placeCallout(rect: DOMRect | null, height: number): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxTop = Math.max(VIEWPORT_MARGIN, vh - height - VIEWPORT_MARGIN);
  const clampTop = (value: number) => Math.min(Math.max(VIEWPORT_MARGIN, value), maxTop);

  if (!rect) {
    return { left: (vw - CALLOUT_WIDTH) / 2, top: clampTop(vh / 2 - height / 2) };
  }

  let top = rect.bottom + CALLOUT_GAP;
  if (top + height > vh - VIEWPORT_MARGIN) {
    top = rect.top - CALLOUT_GAP - height;
  }

  const centred = rect.left + rect.width / 2 - CALLOUT_WIDTH / 2;
  const left = Math.min(Math.max(VIEWPORT_MARGIN, centred), vw - CALLOUT_WIDTH - VIEWPORT_MARGIN);
  return { left, top: clampTop(top) };
}

export default function HelpOverlay() {
  const { mode, step, close, setStep } = useHelp();
  const location = useLocation();
  const navigate = useNavigate();
  const [screenSteps, setScreenSteps] = useState<ScreenSteps>({ content: [], chrome: [] });
  const [tourSteps, setTourSteps] = useState<Step[]>([]);
  const [withChrome, setWithChrome] = useState(false);
  const [collected, setCollected] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const calloutRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [calloutHeight, setCalloutHeight] = useState(CALLOUT_ESTIMATED_HEIGHT);

  useEffect(() => {
    if (!mode) {
      setScreenSteps({ content: [], chrome: [] });
      setTourSteps([]);
      setCollected(false);
      setWithChrome(false);
      return;
    }
    if (mode === "tour") {
      setTourSteps(HELP_TOUR);
      setCollected(true);
      return;
    }
    const raf = requestAnimationFrame(() => {
      setScreenSteps(collectScreenSteps(location.pathname));
      setWithChrome(screenIdForPath(location.pathname) === "home");
      setCollected(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [mode, location.pathname]);

  const steps: Step[] =
    mode === "tour"
      ? tourSteps
      : withChrome
        ? [...screenSteps.content, ...screenSteps.chrome]
        : screenSteps.content;

  const total = steps.length;
  const current: Step | null = total > 0 ? steps[Math.min(step, total - 1)] ?? null : null;

  useEffect(() => {
    if (mode !== "tour" || !current?.path) return;
    if (location.pathname !== current.path) navigate(current.path);
  }, [mode, current, location.pathname, navigate]);

  useLayoutEffect(() => {
    if (!mode || !current) {
      setRect(null);
      return;
    }
    if (!current.anchor) {
      setRect(null);
      return;
    }
    const anchor = current.anchor;

    function measure() {
      const el = anchorElement(anchor);
      setRect(el ? el.getBoundingClientRect() : null);
    }

    const el = anchorElement(anchor);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();

    const scrollEl = document.querySelector(".app-layout__main");
    window.addEventListener("resize", measure);
    scrollEl?.addEventListener("scroll", measure);
    const raf = requestAnimationFrame(measure);
    return () => {
      window.removeEventListener("resize", measure);
      scrollEl?.removeEventListener("scroll", measure);
      cancelAnimationFrame(raf);
    };
  }, [mode, current]);

  useLayoutEffect(() => {
    const node = calloutRef.current;
    if (!node) return;
    const measured = node.offsetHeight;
    if (measured > 0 && Math.abs(measured - calloutHeight) > 1) setCalloutHeight(measured);
  });

  const goNext = useCallback(() => {
    if (step + 1 >= total) close();
    else setStep(step + 1);
  }, [step, total, close, setStep]);

  const goPrev = useCallback(() => setStep(Math.max(0, step - 1)), [step, setStep]);

  useEffect(() => {
    if (!mode) return;
    rootRef.current?.focus();
  }, [mode]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      const onControl = Boolean(target?.closest?.("button, a, input, textarea, select"));
      const action = tourKeyAction(event.key, onControl);
      if (!action) return;
      event.preventDefault();
      if (action === "close") close();
      else if (action === "next") goNext();
      else goPrev();
    },
    [close, goNext, goPrev],
  );

  if (!mode) return null;

  if (!collected) {
    return (
      <div
      className="help-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Help"
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
        <div className="help-overlay__scrim" onClick={close} data-dim="full" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div
      className="help-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Help"
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
        <div className="help-overlay__scrim" onClick={close} />
        <div
          className="help-overlay__callout"
          ref={calloutRef}
          style={{ ...placeCallout(null, calloutHeight), width: CALLOUT_WIDTH }}
        >
          <h2 className="help-overlay__title">No hints for this screen yet</h2>
          <p className="help-overlay__body">Take a look at other screens — they have explanations.</p>
          <div className="help-overlay__actions">
            <button type="button" className="help-overlay__button help-overlay__button--primary" onClick={close}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const placement = placeCallout(rect, calloutHeight);
  const isTour = mode === "tour";
  const lastStep = step >= total - 1;

  const contentCount = screenSteps.content.length;
  const inChrome = current?.group === "chrome";
  const groupLabel = isTour
    ? "Getting to know the app"
    : inChrome
      ? "Shared across the whole app"
      : SCREEN_TITLES[screenIdForPath(location.pathname)];
  const groupTotal = isTour ? total : inChrome ? total - contentCount : contentCount;
  const groupIndex = isTour ? step + 1 : inChrome ? step + 1 - contentCount : step + 1;
  const leavingContent = !isTour && !inChrome && step + 1 === contentCount && total > contentCount;
  const canAddChrome = !isTour && !withChrome && screenSteps.chrome.length > 0 && lastStep;
  function showChrome() {
    setWithChrome(true);
    setStep(contentCount);
  }

  return (
    <div
      className="help-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Help"
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="help-overlay__scrim" onClick={close} data-dim={rect ? "cutout" : "full"} />

      {rect && (
        <div
          className="help-overlay__spot"
          style={{
            left: rect.left - SPOT_PADDING,
            top: rect.top - SPOT_PADDING,
            width: rect.width + SPOT_PADDING * 2,
            height: rect.height + SPOT_PADDING * 2,
          }}
        />
      )}

      <div className="help-overlay__callout" ref={calloutRef} style={{ ...placement, width: CALLOUT_WIDTH }}>
        <p className="help-overlay__counter">
          {groupLabel} · {groupIndex} of {groupTotal}
        </p>
        <h2 className="help-overlay__title">{current?.title}</h2>
        {(current?.body ?? "").split("\n\n").map((paragraph, i) => (
          <p key={i} className="help-overlay__body">
            {paragraph}
          </p>
        ))}
        <div className="help-overlay__actions">
          <button type="button" className="help-overlay__button help-overlay__button--quiet" onClick={close}>
            {isTour && !lastStep ? "Skip" : "Close"}
          </button>
          <span className="help-overlay__spacer" />
          {step > 0 && (
            <button type="button" className="help-overlay__button" onClick={goPrev}>
              Back
            </button>
          )}
          {canAddChrome && (
            <button type="button" className="help-overlay__button" onClick={showChrome}>
              About the menu and bar
            </button>
          )}
          <button type="button" className="help-overlay__button help-overlay__button--primary" onClick={goNext}>
            {lastStep ? "Got it" : leavingContent ? "Next: shared" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
