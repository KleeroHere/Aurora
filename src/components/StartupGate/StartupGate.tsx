import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import SplashScreen from "./SplashScreen";
import LoginScreen from "./LoginScreen";
import TrainingCourse from "../TrainingCourse/TrainingCourse";
import { useCurrentUser } from "../../context/CurrentUserContext";
import { getMaterialById, getTrainingProgress, getTrainingSettings } from "../../data/repository";
import { areCourseMaterialsAvailable, isTrainingRequired } from "../../data/training";

type Stage = "splash" | "login" | "training" | "app";

/**
 * The splash screen on start, the sign-in screen over its last frame — and now
 * the induction course between signing in and the app.
 *
 * Every launch starts over (nothing is persisted) and the splash can always be
 * skipped (a click or a key). It does not look at the route: the gate wraps the
 * whole page tree rather than sitting inside the router.
 *
 * The course is shown only if it is switched on in Administration AND the person
 * who signed in has no completion mark. While the settings are being read they
 * are already inside: holding somebody on a blank screen for a check that almost
 * always answers "no course needed" would slow every sign-in for the sake of the
 * first one. The course is not a guard on the data, it is an order of induction;
 * a second earlier or later makes no difference.
 */
export default function StartupGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("splash");
  const { currentUser } = useCurrentUser();
  /**
   * Who the course decision has already been made for during this launch.
   *
   * Without this mark there would be an endless loop: the course writes
   * `trainingCompletedAt` into the database, but the user object in context
   * stays as it was when they signed in. The check on leaving the course would
   * see the mark missing and send the person back to step one, over and over.
   * Re-reading the user is not needed for this: the decision is made once per
   * sign-in, and keeping it here is enough.
   */
  const decidedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (stage !== "app" || !currentUser) return;
    if (decidedForRef.current === currentUser._id) return;
    let cancelled = false;
    Promise.all([getTrainingSettings(), getTrainingProgress(currentUser._id)])
      .then(async ([settings, progress]) => {
        if (cancelled) return;
        if (!isTrainingRequired(currentUser, settings, progress)) {
          decidedForRef.current = currentUser._id;
          return;
        }
        // The course articles may not have reached this machine. Do not raise a
        // barrier that cannot be passed — see areCourseMaterialsAvailable.
        const ready = await areCourseMaterialsAvailable(getMaterialById);
        if (cancelled) return;
        decidedForRef.current = currentUser._id;
        if (ready) setStage("training");
      })
      // The settings did not read — do not show the course. Locking somebody out
      // because a settings read failed is worse than a course that never showed.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [stage, currentUser]);

  if (stage === "splash") {
    return <SplashScreen onDone={() => setStage("login")} />;
  }
  if (stage === "login") {
    return <LoginScreen onContinue={() => setStage("app")} />;
  }
  if (stage === "training" && currentUser) {
    return (
      <TrainingCourse
        userId={currentUser._id}
        displayName={currentUser.displayName || currentUser.login}
        onFinished={() => setStage("app")}
      />
    );
  }
  return <>{children}</>;
}
