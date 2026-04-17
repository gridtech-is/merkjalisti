// src/services/stationService.ts
import type { GitHubApi } from '../github/api';
import type { StationSignals, BaySignal, ProjectPhase } from '../types';
import { appendChange } from './changelogService';

export interface StationFile {
  station: StationSignals;
  sha: string;
}

function stationPath(projectId: string): string {
  return `projects/${projectId}/station_signals.json`;
}

export async function loadStation(api: GitHubApi, projectId: string): Promise<StationFile> {
  const { data, sha } = await api.readJson<unknown>(stationPath(projectId));
  const station: StationSignals =
    data == null
      ? { status: 'DRAFT', review: null, signals: [] }
      : Array.isArray(data)
        ? { status: 'DRAFT', review: null, signals: data as BaySignal[] }
        : data as StationSignals;
  return { station, sha };
}

export async function saveStation(
  api: GitHubApi,
  projectId: string,
  file: StationFile,
  phase: ProjectPhase
): Promise<StationFile> {
  const msg = `[${phase}] Vista stöðvarmerki`;
  const sha = await api.writeJson(stationPath(projectId), file.station, file.sha, msg);
  return { ...file, sha };
}

export async function sendStationForReview(
  api: GitHubApi,
  projectId: string,
  file: StationFile,
  sentBy: string
): Promise<StationFile> {
  const now = new Date().toISOString();
  const updated: StationSignals = {
    ...file.station,
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
  const msg = `[REVIEW] Stöðvarmerki sent í yfirferð`;
  const sha = await api.writeJson(stationPath(projectId), updated, file.sha, msg);
  await appendChange(api, projectId, {
    user: sentBy, phase: 'REVIEW', type: 'REVIEW_ADDED',
    target_id: projectId, target_type: 'station',
    field: null, old_value: 'DRAFT', new_value: 'IN_REVIEW',
    comment: 'Stöðvarmerki send í yfirferð',
  });
  return { station: updated, sha };
}

export async function approveStation(
  api: GitHubApi,
  projectId: string,
  file: StationFile,
  reviewedBy: string,
  comment: string | null
): Promise<StationFile> {
  const now = new Date().toISOString();
  const updated: StationSignals = {
    ...file.station,
    status: 'LOCKED',
    review: {
      sent_by: file.station.review?.sent_by ?? reviewedBy,
      sent_at: file.station.review?.sent_at ?? now,
      reviewed_by: reviewedBy,
      reviewed_at: now,
      status: 'APPROVED',
      comment,
    },
  };
  const msg = `[REVIEW] Stöðvarmerki samþykkt`;
  const sha = await api.writeJson(stationPath(projectId), updated, file.sha, msg);
  await appendChange(api, projectId, {
    user: reviewedBy, phase: 'REVIEW', type: 'REVIEW_APPROVED',
    target_id: projectId, target_type: 'station',
    field: null, old_value: 'IN_REVIEW', new_value: 'LOCKED',
    comment: 'Stöðvarmerki samþykkt',
  });
  return { station: updated, sha };
}

export async function rejectStation(
  api: GitHubApi,
  projectId: string,
  file: StationFile,
  reviewedBy: string,
  comment: string
): Promise<StationFile> {
  const now = new Date().toISOString();
  const updated: StationSignals = {
    ...file.station,
    status: 'DRAFT',
    review: {
      sent_by: file.station.review?.sent_by ?? reviewedBy,
      sent_at: file.station.review?.sent_at ?? now,
      reviewed_by: reviewedBy,
      reviewed_at: now,
      status: 'REJECTED',
      comment,
    },
  };
  const msg = `[REVIEW] Stöðvarmerki hafnað`;
  const sha = await api.writeJson(stationPath(projectId), updated, file.sha, msg);
  await appendChange(api, projectId, {
    user: reviewedBy, phase: 'REVIEW', type: 'REVIEW_REJECTED',
    target_id: projectId, target_type: 'station',
    field: null, old_value: 'IN_REVIEW', new_value: 'DRAFT',
    comment: `Stöðvarmerki hafnað. ${comment}`,
  });
  return { station: updated, sha };
}
