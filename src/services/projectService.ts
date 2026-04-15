// src/services/projectService.ts
import type { GitHubApi } from '../github/api';
import type {
  Project, Equipment, BaySignal, ChangeEntry, Testing
} from '../types';

export interface ProjectFiles {
  project: Project;
  projectSha: string;
  equipment: Equipment[];
  equipmentSha: string;
  stationSignals: BaySignal[];
  stationSignalsSha: string;
  changelog: ChangeEntry[];
  changelogSha: string;
  testing: Testing;
  testingSha: string;
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export async function createProject(
  api: GitHubApi,
  name: string,
  createdBy: string
): Promise<ProjectFiles> {
  const id = uuid();
  const now = new Date().toISOString();
  const base = `projects/${id}`;

  const project: Project = {
    id, name, description: '', created: now, phase: 'DESIGN', review: null,
  };
  const equipment: Equipment[] = [];
  const stationSignals: BaySignal[] = [];
  const changelog: ChangeEntry[] = [{
    id: uuid(), timestamp: now, user: createdBy, phase: 'DESIGN',
    type: 'PHASE_CHANGED', target_id: id, target_type: 'project',
    field: null, old_value: null, new_value: 'DESIGN',
    comment: `Verkefni stofnað: ${name}`,
  }];
  const testing: Testing = {
    fat_started: null, fat_completed: null,
    sat_started: null, sat_completed: null, entries: [],
  };

  const msg = `[DESIGN] Nýtt verkefni: ${name}`;
  // Sequential writes — GitHub Contents API creates one commit per call;
  // parallel writes to the same branch cause 409 Conflict.
  const ps = await api.writeJson(`${base}/project.json`, project, null, msg);
  const es = await api.writeJson(`${base}/equipment.json`, equipment, null, msg);
  const ss = await api.writeJson(`${base}/station_signals.json`, stationSignals, null, msg);
  const cs = await api.writeJson(`${base}/changelog.json`, changelog, null, msg);
  const ts = await api.writeJson(`${base}/testing.json`, testing, null, msg);

  return {
    project, projectSha: ps,
    equipment, equipmentSha: es,
    stationSignals, stationSignalsSha: ss,
    changelog, changelogSha: cs,
    testing, testingSha: ts,
  };
}

export async function listProjects(api: GitHubApi): Promise<Project[]> {
  let entries: string[];
  try {
    entries = await api.listDirectory('projects');
  } catch {
    return []; // projects/ directory doesn't exist yet
  }
  const uuids = entries.filter(e => /^[0-9a-f-]{36}$/.test(e));

  const results = await Promise.allSettled(
    uuids.map(id => api.readJson<Project>(`projects/${id}/project.json`))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ data: Project; sha: string }> => r.status === 'fulfilled')
    .map(r => r.value.data);
}

export async function loadProject(api: GitHubApi, id: string): Promise<ProjectFiles> {
  const base = `projects/${id}`;
  const [p, e, s, c, t] = await Promise.all([
    api.readJson<Project>(`${base}/project.json`),
    api.readJson<Equipment[]>(`${base}/equipment.json`),
    api.readJson<BaySignal[]>(`${base}/station_signals.json`),
    api.readJson<ChangeEntry[]>(`${base}/changelog.json`),
    api.readJson<Testing>(`${base}/testing.json`),
  ]);
  return {
    project: p.data, projectSha: p.sha,
    equipment: e.data, equipmentSha: e.sha,
    stationSignals: s.data, stationSignalsSha: s.sha,
    changelog: c.data, changelogSha: c.sha,
    testing: t.data, testingSha: t.sha,
  };
}

export async function saveProject(
  api: GitHubApi,
  files: ProjectFiles
): Promise<ProjectFiles> {
  const id = files.project.id;
  const base = `projects/${id}`;
  const phase = files.project.phase;
  const msg = `[${phase}] Vista verkefni: ${files.project.name}`;

  const ps = await api.writeJson(`${base}/project.json`, files.project, files.projectSha, msg);
  const es = await api.writeJson(`${base}/equipment.json`, files.equipment, files.equipmentSha, msg);
  const ss = await api.writeJson(`${base}/station_signals.json`, files.stationSignals, files.stationSignalsSha, msg);
  const cs = await api.writeJson(`${base}/changelog.json`, files.changelog, files.changelogSha, msg);
  const ts = await api.writeJson(`${base}/testing.json`, files.testing, files.testingSha, msg);

  return {
    ...files,
    projectSha: ps, equipmentSha: es,
    stationSignalsSha: ss, changelogSha: cs, testingSha: ts,
  };
}
