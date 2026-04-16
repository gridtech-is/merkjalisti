// src/services/bayService.ts
import type { GitHubApi } from '../github/api';
import type { Bay, BaySignal, BayTemplate } from '../types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export interface BayFile {
  bay: Bay;
  sha: string;
}

export async function createBay(
  api: GitHubApi,
  projectId: string,
  station: string,
  voltageLevel: string,
  bayName: string,
  signals: BaySignal[],
  createdBy: string
): Promise<BayFile> {
  const id = uuid();
  const bay: Bay = {
    id,
    station,
    voltage_level: voltageLevel,
    bay_name: bayName,
    display_id: `${station}${bayName}`,
    equipment_ids: [],
    signals,
  };
  const path = `projects/${projectId}/bays/${id}.json`;
  const msg = `[DESIGN] Nýr reitur: ${bay.display_id}`;
  const sha = await api.writeJson(path, bay, null, msg);
  return { bay, sha };
}

export async function listBays(api: GitHubApi, projectId: string): Promise<Bay[]> {
  let entries: string[];
  try {
    entries = await api.listDirectory(`projects/${projectId}/bays`);
  } catch {
    return []; // bays/ directory doesn't exist yet
  }
  const jsonFiles = entries.filter(e => e.endsWith('.json'));
  const results = await Promise.allSettled(
    jsonFiles.map(f => api.readJson<Bay>(`projects/${projectId}/bays/${f}`))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<{ data: Bay; sha: string }> => r.status === 'fulfilled')
    .map(r => r.value.data);
}

export async function loadBay(api: GitHubApi, projectId: string, bayId: string): Promise<BayFile> {
  const path = `projects/${projectId}/bays/${bayId}.json`;
  const { data, sha } = await api.readJson<Bay>(path);
  return { bay: data, sha };
}

export async function saveBayTemplate(
  api: GitHubApi,
  bay: Bay,
  templateName: string
): Promise<void> {
  const template: BayTemplate = {
    template_name: templateName,
    station: bay.station,
    voltage_level: bay.voltage_level,
    bay_name: bay.bay_name,
    display_id: bay.display_id,
    equipment_codes: [],
    signals: bay.signals.map(({ phase_added: _p, ...rest }) => rest),
  };
  const id = uuid();
  await api.writeJson(
    `data/bay_templates/${id}.json`,
    template,
    null,
    `Bay sniðmát: ${templateName}`
  );
}

export async function listBayTemplates(api: GitHubApi): Promise<BayTemplate[]> {
  try {
    const entries = await api.listDirectory('data/bay_templates');
    const results = await Promise.allSettled(
      entries.filter(e => e.endsWith('.json'))
        .map(f => api.readJson<BayTemplate>(`data/bay_templates/${f}`))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<{ data: BayTemplate; sha: string }> => r.status === 'fulfilled')
      .map(r => r.value.data);
  } catch {
    return [];
  }
}

export async function saveBay(
  api: GitHubApi,
  projectId: string,
  bayFile: BayFile,
  phase: string
): Promise<BayFile> {
  const path = `projects/${projectId}/bays/${bayFile.bay.id}.json`;
  const msg = `[${phase}] Vista reit: ${bayFile.bay.display_id}`;
  const sha = await api.writeJson(path, bayFile.bay, bayFile.sha, msg);
  return { ...bayFile, sha };
}
