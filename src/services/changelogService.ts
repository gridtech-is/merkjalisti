import type { GitHubApi } from '../github/api';
import type { ChangeEntry } from '../types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

type NewEntry = Omit<ChangeEntry, 'id' | 'timestamp'>;

export async function appendChange(
  api: GitHubApi,
  projectId: string,
  entry: NewEntry
): Promise<void> {
  const path = `projects/${projectId}/changelog.json`;
  try {
    const { data: existing, sha } = await api.readJson<ChangeEntry[]>(path);
    const newEntry: ChangeEntry = {
      ...entry,
      id: uuid(),
      timestamp: new Date().toISOString(),
    };
    const updated = [...existing, newEntry];
    const msg = `[${entry.phase}] ${entry.type}: ${entry.target_id}`;
    await api.writeJson(path, updated, sha, msg);
  } catch {
    // Fire-and-forget: never block the UI for changelog failures
  }
}
