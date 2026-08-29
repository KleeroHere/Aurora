import { publicUrl } from "../../utils/publicUrl";
import { useEffect, useRef, useState } from "react";
import "./SplashScreen.css";

const INTRO_LAST_FRAME_URL = publicUrl("brand/intro-last-frame.jpg");

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      onDone();
      return;
    }

    function finish() {
      setSkipped(true);
      onDone();
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" || event.key === " " || event.key === "Enter") finish();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finishNow() {
    if (skipped) return;
    setSkipped(true);
    onDone();
  }

  return (
    <div className="splash-screen" onClick={finishNow} role="button" tabIndex={0} aria-label="Skip intro">
      <video
        ref={videoRef}
        className="splash-screen__video"
        poster={INTRO_LAST_FRAME_URL}
        autoPlay
        muted
        playsInline
        onEnded={finishNow}
        onError={finishNow}
      >
        <source src={publicUrl("brand/intro.webm")} type="video/webm" />
        <source src={publicUrl("brand/intro.mp4")} type="video/mp4" />
      </video>
      <span className="splash-screen__hint">Click to skip</span>
    </div>
  );
}
