import type { GitHubApi } from '../github/api';
import type { ZenonConfig } from '../types';

const DEFAULT_CONFIG: ZenonConfig = { driver_name: 'IEC850', net_addr: {} };

function path(projectId: string): string {
  return `projects/${projectId}/zenon_config.json`;
}

export async function loadZenonConfig(
  api: GitHubApi,
  projectId: string,
): Promise<{ data: ZenonConfig; sha: string | null }> {
  try {
    const { data, sha } = await api.readJson<ZenonConfig>(path(projectId));
    return { data, sha };
  } catch {
    return { data: { ...DEFAULT_CONFIG, net_addr: {} }, sha: null };
  }
}

export async function saveZenonConfig(
  api: GitHubApi,
  projectId: string,
  config: ZenonConfig,
  sha: string | null,
): Promise<string> {
  return api.writeJson(path(projectId), config, sha, 'Zenon stillingar uppfærðar');
}
