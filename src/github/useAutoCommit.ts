import { useEffect, useRef } from 'react';

/**
 * Calls commitFn() 30 seconds after isDirty becomes true.
 * Timer only resets when isDirty transitions false→true (new edit).
 * Cancels if component unmounts.
 */
export function useAutoCommit(
  isDirty: boolean,
  commitFn: () => Promise<void>
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commitFn);
  const wasDirtyRef = useRef(false);
  commitRef.current = commitFn;

  useEffect(() => {
    const wasAlreadyDirty = wasDirtyRef.current;
    wasDirtyRef.current = isDirty;

    if (!isDirty) {
      // Became clean — cancel any pending commit
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (wasAlreadyDirty) {
      // Still dirty from before — don't reset the existing timer
      return;
    }

    // Transitioned false→true — start the 30s timer
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      commitRef.current().catch(console.error);
    }, 30_000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isDirty]);
}
