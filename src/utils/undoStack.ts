// src/utils/undoStack.ts

export interface UndoState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createUndoState<T>(initial: T): UndoState<T> {
  return { past: [], present: initial, future: [] };
}

export function undoPush<T>(state: UndoState<T>, next: T, maxSize = 20): UndoState<T> {
  return {
    past: [...state.past.slice(-(maxSize - 1)), state.present],
    present: next,
    future: [],
  };
}

export function undoUndo<T>(state: UndoState<T>): UndoState<T> {
  if (state.past.length === 0) return state;
  return {
    past: state.past.slice(0, -1),
    present: state.past[state.past.length - 1],
    future: [state.present, ...state.future.slice(0, 19)],
  };
}

export function undoRedo<T>(state: UndoState<T>): UndoState<T> {
  if (state.future.length === 0) return state;
  return {
    past: [...state.past.slice(-19), state.present],
    present: state.future[0],
    future: state.future.slice(1),
  };
}
