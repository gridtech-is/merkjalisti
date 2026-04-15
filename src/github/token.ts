const KEY = 'merkjalisti-gh-token';
const OWNER_KEY = 'merkjalisti-gh-owner';
const REPO_KEY = 'merkjalisti-gh-repo';

export function saveToken(token: string, owner: string, repo: string): void {
  localStorage.setItem(KEY, token);
  localStorage.setItem(OWNER_KEY, owner);
  localStorage.setItem(REPO_KEY, repo);
}

export function loadToken(): { token: string; owner: string; repo: string } | null {
  const token = localStorage.getItem(KEY);
  const owner = localStorage.getItem(OWNER_KEY);
  const repo = localStorage.getItem(REPO_KEY);
  if (!token || !owner || !repo) return null;
  return { token, owner, repo };
}

export function clearToken(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem(OWNER_KEY);
  localStorage.removeItem(REPO_KEY);
}
