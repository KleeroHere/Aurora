import { useEffect, useRef, useState } from "react";
import type { MaterialVideo } from "../../data/types";
import { formatDuration, isSafeVideoPath } from "../../data/videoPort";
import { selectVideoPort } from "../../data/videoPortSelect";
import { clearVideoPosition, readVideoPosition, writeVideoPosition } from "../../data/videoPosition";
import "./VideoPlayer.css";
import { humanError } from "../../utils/humanText";

type State =
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "missing"; reason: string }
  | { kind: "broken"; reason: string };

export default function VideoPlayer({ materialId, video }: { materialId: string; video: MaterialVideo }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });

    if (!isSafeVideoPath(video.path)) {
      setState({
        kind: "broken",
        reason: `The video path is written incorrectly: "${video.path}". Expected a file name inside the videos folder.`,
      });
      return;
    }

    selectVideoPort()
      .then((port) => port.resolveVideoUrl(video.path))
      .then((url) => {
        if (cancelled) return;
        setState({ kind: "ready", url });
        setResumeFrom(readVideoPosition(materialId));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ kind: "missing", reason: humanError(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [materialId, video.path, retryToken]);

  function remember() {
    const element = videoRef.current;
    if (!element || !Number.isFinite(element.duration)) return;
    writeVideoPosition(materialId, element.currentTime, element.duration);
  }

  useEffect(() => {
    return () => {
      remember();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId]);

  function handleLoadedMetadata() {
    const element = videoRef.current;
    if (!element) return;
    if (resumeFrom === null) {
      if (video.posterFrameSec !== null && video.posterFrameSec < element.duration) {
        element.currentTime = video.posterFrameSec;
      }
      return;
    }
    if (resumeFrom < element.duration - 1) {
      element.currentTime = resumeFrom;
    } else {
      clearVideoPosition(materialId);
      setResumeFrom(null);
    }
  }

  if (state.kind === "loading") {
    return <p className="video-player__hint">Looking for the video file…</p>;
  }

  if (state.kind === "missing" || state.kind === "broken") {
    return (
      <div className="video-player__missing" role="status">
        <p className="video-player__missing-title">
          {state.kind === "missing" ? "Video file not found" : "Video entry has an error"}
        </p>
        <p className="video-player__missing-text">{state.reason}</p>
        {state.kind === "missing" && (
          <>
            <p className="video-player__missing-text">
              Videos are not stored inside the database and are transferred separately — the material is already here,
              the file is not yet. Put <code>{video.path}</code> into the <code>videos</code> folder next to the app
              and click "Check again".
            </p>
            <button
              type="button"
              className="video-player__retry"
              onClick={() => setRetryToken((token) => token + 1)}
            >
              Check again
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="video-player">
      <video
        ref={videoRef}
        className="video-player__video"
        src={state.url}
        controls
        preload="metadata"
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onPause={remember}
        onEnded={() => clearVideoPosition(materialId)}
        onError={() =>
          setState({
            kind: "broken",
            reason:
              "The file was found but does not play. Most likely it is not H.264/AAC — " +
              "the app only plays mp4 with that codec.",
          })
        }
      />
      <p className="video-player__meta">
        {resumeFrom !== null && (
          <span className="video-player__resumed">Resuming from {formatDuration(resumeFrom)}. </span>
        )}
        {video.durationSec ? `Duration ${formatDuration(video.durationSec)}. ` : ""}
        {video.width && video.height ? `${video.width}×${video.height}. ` : ""}
        <code>videos/{video.path}</code>
      </p>
    </div>
  );
}
