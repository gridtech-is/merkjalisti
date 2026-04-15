import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { GitHubApi } from '../github/api';
import { loadToken } from '../github/token';

interface ApiContextValue {
  api: GitHubApi;
  owner: string;
  repo: string;
  userName: string;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const config = loadToken();
  if (!config) throw new Error('ApiProvider requires a saved token');

  const value = useMemo(() => ({
    api: new GitHubApi(config.token, config.owner, config.repo),
    owner: config.owner,
    repo: config.repo,
    userName: config.owner,
  }), [config.token, config.owner, config.repo]);

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used inside ApiProvider');
  return ctx;
}
