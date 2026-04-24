import type { GitHubApi } from '../github/api';
import type { SignalUnit } from '../types';

const PATH = 'data/signal_units.json';

export async function listSignalUnits(api: GitHubApi): Promise<{ units: SignalUnit[]; sha: string }> {
  try {
    const { data, sha } = await api.readJson<SignalUnit[]>(PATH);
    return { units: data, sha };
  } catch {
    return { units: [], sha: '' };
  }
}

export async function saveSignalUnits(
  api: GitHubApi,
  units: SignalUnit[],
  sha: string,
  msg: string,
): Promise<string> {
  return api.writeJson(PATH, units, sha || null, msg);
}
