import { useEffect, useRef } from 'react';

/**
 * Calls commitFn() 30 seconds after isDirty becomes true.
 * Timer only resets when isDirty transitions false→true (new edit).
 * Also calls commitFn() immediately on unmount if still dirty.
 */
export function useAutoCommit(
  isDirty: boolean,
  commitFn: () => Promise<void>
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commitFn);
  const isDirtyRef = useRef(isDirty);
  const wasDirtyRef = useRef(false);
  commitRef.current = commitFn;
  isDirtyRef.current = isDirty;

  useEffect(() => {
    const wasAlreadyDirty = wasDirtyRef.current;
    wasDirtyRef.current = isDirty;

    if (!isDirty) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (wasAlreadyDirty) return;

    // Transitioned false→true — start the 30s timer
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      isDirtyRef.current = false; // prevent unmount from double-committing
      commitRef.current().catch(console.error);
    }, 30_000);
  }, [isDirty]);

  // On unmount: if still dirty, save immediately
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (isDirtyRef.current) {
        commitRef.current().catch(console.error);
      }
    };
  }, []);
}
