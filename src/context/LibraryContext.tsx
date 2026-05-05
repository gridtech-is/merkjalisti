import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useApi } from './ApiContext';
import type { SignalLibraryEntry, SignalState, ZenonTagCategory } from '../types';
import { listZenonTagCategories } from '../services/zenonTagCategoryService';

interface LibraryContextValue {
  signalLibrary: SignalLibraryEntry[];
  signalLibrarySha: string;
  signalStates: SignalState[];
  signalStatesSha: string;
  zenonTagCategories: ZenonTagCategory[];
  zenonTagCategoriesSha: string;
  loading: boolean;
  updateLibrary: (data: SignalLibraryEntry[], sha: string) => void;
  updateStates: (data: SignalState[], sha: string) => void;
  updateZenonTagCategories: (data: ZenonTagCategory[], sha: string) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { api } = useApi();
  const [signalLibrary, setSignalLibrary] = useState<SignalLibraryEntry[]>([]);
  const [signalLibrarySha, setSignalLibrarySha] = useState('');
  const [signalStates, setSignalStates] = useState<SignalState[]>([]);
  const [signalStatesSha, setSignalStatesSha] = useState('');
  const [zenonTagCategories, setZenonTagCategories] = useState<ZenonTagCategory[]>([]);
  const [zenonTagCategoriesSha, setZenonTagCategoriesSha] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.readJson<SignalLibraryEntry[]>('data/signal_library.json'),
      api.readJson<SignalState[]>('data/signal_states.json'),
      listZenonTagCategories(api),
    ]).then(([lib, states, cats]) => {
      setSignalLibrary(lib.data);
      setSignalLibrarySha(lib.sha);
      setSignalStates(states.data);
      setSignalStatesSha(states.sha);
      setZenonTagCategories(cats.categories);
      setZenonTagCategoriesSha(cats.sha);
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

  function updateZenonTagCategories(data: ZenonTagCategory[], sha: string) {
    setZenonTagCategories(data);
    setZenonTagCategoriesSha(sha);
  }

  return (
    <LibraryContext.Provider value={{
      signalLibrary, signalLibrarySha,
      signalStates, signalStatesSha,
      zenonTagCategories, zenonTagCategoriesSha,
      loading,
      updateLibrary, updateStates, updateZenonTagCategories,
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
