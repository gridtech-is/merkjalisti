// src/services/bayService.ts
import type { GitHubApi } from '../github/api';
import type { Bay, BaySignal, BayTemplate } from '../types';
import { appendChange } from './changelogService';

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
  _createdBy: string
): Promise<BayFile> {
  const id = uuid();
  const bay: Bay = {
    id,
    station,
    voltage_level: voltageLevel,
    bay_name: bayName,
    display_id: `${station}${bayName}`,
    equipment_ids: [],
    signals: signals.map(s => ({
      ...s,
      review_flagged: s.review_flagged ?? false,
      review_comment: s.review_comment ?? null,
    })),
    status: 'DRAFT',
    review: null,
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
    return [];
  }
  const jsonFiles = entries.filter(e => e.endsWith('.json'));
  const results = await Promise.allSettled(
    jsonFiles.map(f => api.readJson<Bay>(`projects/${projectId}/bays/${f}`))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<{ data: Bay; sha: string }> => r.status === 'fulfilled')
    .map(r => {
      const data = r.value.data;
      return {
        ...data,
        status: data.status ?? ('DRAFT' as const),
        review: data.review ?? null,
        signals: data.signals.map(s => ({
          ...s,
          review_flagged: s.review_flagged ?? false,
          review_comment: s.review_comment ?? null,
        })),
      };
    });
}

export async function loadBay(api: GitHubApi, projectId: string, bayId: string): Promise<BayFile> {
  const path = `projects/${projectId}/bays/${bayId}.json`;
  const { data, sha } = await api.readJson<Bay>(path);
  const bay: Bay = {
    ...data,
    status: data.status ?? 'DRAFT',
    review: data.review ?? null,
    signals: data.signals.map(s => ({
      ...s,
      review_flagged: s.review_flagged ?? false,
      review_comment: s.review_comment ?? null,
    })),
  };
  return { bay, sha };
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

export async function sendBayForReview(
  api: GitHubApi,
  projectId: string,
  bayFile: BayFile,
  sentBy: string
): Promise<BayFile> {
  const now = new Date().toISOString();
  const updated: Bay = {
    ...bayFile.bay,
    status: 'IN_REVIEW',
    review: {
      sent_by: sentBy,
      sent_at: now,
      reviewed_by: null,
      reviewed_at: null,
      status: 'OPEN',
      comment: null,
    },
  };
  const path = `projects/${projectId}/bays/${bayFile.bay.id}.json`;
  const msg = `[REVIEW] Sent í yfirferð: ${bayFile.bay.display_id}`;
  const sha = await api.writeJson(path, updated, bayFile.sha, msg);
  appendChange(api, projectId, {
    user: sentBy, phase: 'REVIEW', type: 'REVIEW_ADDED',
    target_id: bayFile.bay.id, target_type: 'bay',
    field: null, old_value: 'DRAFT', new_value: 'IN_REVIEW',
    comment: `Reitur sendur í yfirferð: ${bayFile.bay.display_id}`,
  });
  return { bay: updated, sha };
}

export async function approveBay(
  api: GitHubApi,
  projectId: string,
  bayFile: BayFile,
  reviewedBy: string,
  comment: string | null
): Promise<BayFile> {
  const now = new Date().toISOString();
  const updated: Bay = {
    ...bayFile.bay,
    status: 'LOCKED',
    review: {
      ...(bayFile.bay.review ?? { sent_by: reviewedBy, sent_at: now }),
      reviewed_by: reviewedBy,
      reviewed_at: now,
      status: 'APPROVED',
      comment,
    },
  };
  const path = `projects/${projectId}/bays/${bayFile.bay.id}.json`;
  const msg = `[REVIEW] Samþykkt: ${bayFile.bay.display_id}`;
  const sha = await api.writeJson(path, updated, bayFile.sha, msg);
  appendChange(api, projectId, {
    user: reviewedBy, phase: 'REVIEW', type: 'REVIEW_ADDED',
    target_id: bayFile.bay.id, target_type: 'bay',
    field: null, old_value: 'IN_REVIEW', new_value: 'LOCKED',
    comment: `Reitur samþykktur: ${bayFile.bay.display_id}`,
  });
  return { bay: updated, sha };
}

export async function rejectBay(
  api: GitHubApi,
  projectId: string,
  bayFile: BayFile,
  reviewedBy: string,
  comment: string
): Promise<BayFile> {
  const now = new Date().toISOString();
  const updated: Bay = {
    ...bayFile.bay,
    status: 'DRAFT',
    review: {
      ...(bayFile.bay.review ?? { sent_by: reviewedBy, sent_at: now }),
      reviewed_by: reviewedBy,
      reviewed_at: now,
      status: 'REJECTED',
      comment,
    },
  };
  const path = `projects/${projectId}/bays/${bayFile.bay.id}.json`;
  const msg = `[REVIEW] Hafnað: ${bayFile.bay.display_id}`;
  const sha = await api.writeJson(path, updated, bayFile.sha, msg);
  appendChange(api, projectId, {
    user: reviewedBy, phase: 'REVIEW', type: 'REVIEW_ADDED',
    target_id: bayFile.bay.id, target_type: 'bay',
    field: null, old_value: 'IN_REVIEW', new_value: 'DRAFT',
    comment: `Reitur hafnaður: ${bayFile.bay.display_id}. ${comment}`,
  });
  return { bay: updated, sha };
}
