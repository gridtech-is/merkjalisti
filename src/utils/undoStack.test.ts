// src/utils/undoStack.test.ts
import { describe, it, expect } from 'vitest';
import { createUndoState, undoPush, undoUndo, undoRedo } from './undoStack';

describe('undoPush', () => {
  it('moves present to past and sets new present', () => {
    const s = createUndoState([1]);
    const s1 = undoPush(s, [2]);
    expect(s1.past).toEqual([[1]]);
    expect(s1.present).toEqual([2]);
    expect(s1.future).toEqual([]);
  });

  it('clears future on push', () => {
    const s = createUndoState([1]);
    const s1 = undoPush(s, [2]);
    const s2 = undoUndo(s1);
    const s3 = undoPush(s2, [3]);
    expect(s3.future).toEqual([]);
    expect(s3.present).toEqual([3]);
  });

  it('caps past at maxSize', () => {
    let s = createUndoState([0]);
    for (let i = 1; i <= 25; i++) s = undoPush(s, [i], 20);
    expect(s.past.length).toBe(20);
    expect(s.past[0]).toEqual([5]);
  });
});

describe('undoUndo', () => {
  it('restores previous present and pushes current to future', () => {
    const s = createUndoState([1]);
    const s1 = undoPush(s, [2]);
    const s2 = undoUndo(s1);
    expect(s2.present).toEqual([1]);
    expect(s2.future).toEqual([[2]]);
    expect(s2.past).toEqual([]);
  });

  it('is a no-op when past is empty', () => {
    const s = createUndoState([1]);
    expect(undoUndo(s)).toBe(s);
  });
});

describe('undoRedo', () => {
  it('restores future head and pushes current to past', () => {
    const s = createUndoState([1]);
    const s1 = undoPush(s, [2]);
    const s2 = undoUndo(s1);
    const s3 = undoRedo(s2);
    expect(s3.present).toEqual([2]);
    expect(s3.past).toEqual([[1]]);
    expect(s3.future).toEqual([]);
  });

  it('is a no-op when future is empty', () => {
    const s = createUndoState([1]);
    expect(undoRedo(s)).toBe(s);
  });
});
