import { useEffect } from "react";
import { useCurrentUser } from "../context/CurrentUserContext";
import { recordTrainingView } from "../data/repository";

/**
 * Record that a member of staff opened a material.
 *
 * Hooked onto the material page in one line. It shows nothing and breaks
 * nothing: for anybody without training assigned no mark is written at all (see
 * `recordMaterialView`), and a write error is swallowed — training progress is
 * not worth breaking the reading of an article over.
 *
 * This counts OPENINGS, not reading, and the block card says so in as many
 * words. Counting "scrolled to the end", the way the induction course does, is
 * not possible here: a material may be a one-screen PDF form, and a "scrolled"
 * threshold would mean nothing for it.
 */
export function useTrainingView(materialId: string | undefined): void {
  const { currentUser } = useCurrentUser();
  useEffect(() => {
    if (!currentUser || !materialId) return;
    void recordTrainingView(currentUser._id, materialId);
  }, [currentUser, materialId]);
}
