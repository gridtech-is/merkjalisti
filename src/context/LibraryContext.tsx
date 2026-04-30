import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useApi } from './ApiContext';
import type { SignalLibraryEntry, SignalState } from '../types';

interface LibraryContextValue {
  signalLibrary: SignalLibraryEntry[];
  signalLibrarySha: string;
  signalStates: SignalState[];
  signalStatesSha: string;
  loading: boolean;
  updateLibrary: (data: SignalLibraryEntry[], sha: string) => void;
  updateStates: (data: SignalState[], sha: string) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { api } = useApi();
  const [signalLibrary, setSignalLibrary] = useState<SignalLibraryEntry[]>([]);
  const [signalLibrarySha, setSignalLibrarySha] = useState('');
  const [signalStates, setSignalStates] = useState<SignalState[]>([]);
  const [signalStatesSha, setSignalStatesSha] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.readJson<SignalLibraryEntry[]>('data/signal_library.json'),
      api.readJson<SignalState[]>('data/signal_states.json'),
    ]).then(([lib, states]) => {
      setSignalLibrary(lib.data);
      setSignalLibrarySha(lib.sha);
      setSignalStates(states.data);
      setSignalStatesSha(states.sha);
      setLoading(false);
    });
  }, [api]);

  function updateLibrary(data: SignalLibraryEntry[], sha: string) {
    setSignalLibrary(data);
    setSignalLibrarySha(sha);
  }

  function updateStates(data: SignalState[], sha: string) {
    setSignalStates(data);
    setSignalStatesSha(sha);
  }

  return (
    <LibraryContext.Provider value={{
      signalLibrary, signalLibrarySha,
      signalStates, signalStatesSha,
      loading,
      updateLibrary, updateStates,
    }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}
