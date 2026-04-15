import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoCommit } from './useAutoCommit';

describe('useAutoCommit', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call commitFn when isDirty is false', () => {
    vi.useFakeTimers();
    const commitFn = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutoCommit(false, commitFn));
    vi.advanceTimersByTime(31_000);
    expect(commitFn).not.toHaveBeenCalled();
  });

  it('calls commitFn after 30 seconds when isDirty is true', async () => {
    vi.useFakeTimers();
    const commitFn = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutoCommit(true, commitFn));
    vi.advanceTimersByTime(30_000);
    await Promise.resolve(); // flush microtasks
    expect(commitFn).toHaveBeenCalledOnce();
  });

  it('does not reset timer on re-render while isDirty stays true', async () => {
    vi.useFakeTimers();
    const commitFn = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ dirty }: { dirty: boolean }) => useAutoCommit(dirty, commitFn),
      { initialProps: { dirty: true } }
    );
    vi.advanceTimersByTime(20_000);
    rerender({ dirty: true }); // still dirty — timer should NOT reset
    vi.advanceTimersByTime(10_001); // total 30s from original start
    await Promise.resolve();
    expect(commitFn).toHaveBeenCalledOnce();
  });
});
