import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCurrentUser } from "../../context/CurrentUserContext";
import { getTrainingProgress, getTrainingSettings } from "../../data/repository";
import { TRAINING_MODULES, isTrainingAssigned } from "../../data/training";
import "./TrainingBadge.css";

/**
 * The unfinished-training badge under the house mark.
 *
 * It stays until every block of the programme is closed, and it links to the
 * programme. It appears only for somebody the training has been ASSIGNED to:
 * a person in their third year should not carry a permanent reminder to go back
 * to school.
 *
 * The count is cheap — one progress document, no walking the sections: a block
 * without a test is marked in `modules` by the programme page itself once all
 * of its materials have been opened (see TrainingProgramPage). The badge just
 * counts marks and does not fetch material lists on every app start.
 *
 * It re-reads on route changes: somebody closes a block on /training and goes
 * back to the materials, and the counter has to be current.
 */
export default function TrainingBadge() {
  const { currentUser } = useCurrentUser();
  const location = useLocation();
  const [done, setDone] = useState<number | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setShow(false);
      return;
    }
    let cancelled = false;
    Promise.all([getTrainingSettings(), getTrainingProgress(currentUser._id)])
      .then(([settings, progress]) => {
        if (cancelled) return;
        const passed = Object.keys(progress.modules ?? {}).length;
        setDone(passed);
        setShow(settings.enabled && isTrainingAssigned(progress) && passed < TRAINING_MODULES.length);
      })
      .catch(() => {
        // The badge is an aid. If it does not read, simply do not show it.
        if (!cancelled) setShow(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser, location.pathname]);

  if (!show || done === null) return null;

  return (
    <Link to="/training" className="training-badge" data-help="training-badge">
      <span className="training-badge__title">Training</span>
      <span className="training-badge__counter">
        {done} of {TRAINING_MODULES.length} blocks
      </span>
      <span className="training-badge__bar" aria-hidden="true">
        <span
          className="training-badge__bar-fill"
          style={{ width: `${Math.round((done / TRAINING_MODULES.length) * 100)}%` }}
        />
      </span>
    </Link>
  );
}
