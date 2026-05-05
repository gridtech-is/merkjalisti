import type { GitHubApi } from '../github/api';
import type { ZenonTagCategory } from '../types';

const PATH = 'data/zenon_tag_categories.json';

export async function listZenonTagCategories(
  api: GitHubApi,
): Promise<{ categories: ZenonTagCategory[]; sha: string }> {
  try {
    const { data, sha } = await api.readJson<ZenonTagCategory[]>(PATH);
    return { categories: data, sha };
  } catch {
    return { categories: [], sha: '' };
  }
}

export async function saveZenonTagCategories(
  api: GitHubApi,
  categories: ZenonTagCategory[],
  sha: string,
  msg: string,
): Promise<string> {
  return api.writeJson(PATH, categories, sha || null, msg);
}
