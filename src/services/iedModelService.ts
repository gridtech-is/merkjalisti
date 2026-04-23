import type { GitHubApi } from '../github/api';
import type { IedFcda } from '../types';
import { parseScd, type ScdIed } from './scdParser';

function modelPath(projectId: string, equipmentId: string): string {
  return `projects/${projectId}/ied_models/${equipmentId}.json`;
}

export function flattenIedModel(ied: ScdIed): IedFcda[] {
  const result: IedFcda[] = [];
  for (const ld of ied.lds) {
    for (const ln of ld.lns) {
      for (const doda of ln.doDas) {
        result.push({
          ldInst: ld.inst,
          prefix: ln.prefix,
          lnClass: ln.lnClass,
          lnInst: ln.inst,
          doName: doda.doName,
          daName: doda.daName,
          fc: doda.fc,
          cdc: doda.cdc,
        });
      }
    }
  }
  return result;
}

export interface ParsedIedMeta {
  fcda: IedFcda[];
  iedName: string;
  manufacturer: string;
  typeCode: string;
  configVersion: string;
  error?: string;
}

export function parseModel(xmlText: string): ParsedIedMeta {
  const { ieds, errors } = parseScd(xmlText);
  if (ieds.length === 0) {
    return { fcda: [], iedName: '', manufacturer: '', typeCode: '', configVersion: '', error: errors[0] ?? 'Engin IED með nafn fannst.' };
  }
  // Pick the IED with the most LDs — avoids template/stub IEDs in multi-IED files
  const ied = ieds.reduce((best, cur) => cur.lds.length > best.lds.length ? cur : best, ieds[0]);
  return {
    fcda: flattenIedModel(ied),
    iedName: ied.name,
    manufacturer: ied.manufacturer,
    typeCode: ied.model,
    configVersion: ied.configVersion,
  };
}

export async function saveModel(
  api: GitHubApi,
  projectId: string,
  equipmentId: string,
  fcda: IedFcda[],
  iedName: string,
): Promise<void> {
  let sha: string | null = null;
  try {
    const existing = await api.readJson<IedFcda[]>(modelPath(projectId, equipmentId));
    sha = existing.sha;
  } catch { /* new file */ }
  await api.writeJson(
    modelPath(projectId, equipmentId),
    fcda,
    sha,
    `Módel hlaðið inn fyrir ${iedName} (${fcda.length} merki)`,
  );
}

export async function parseAndSaveModel(
  api: GitHubApi,
  projectId: string,
  equipmentId: string,
  xmlText: string,
): Promise<ParsedIedMeta> {
  const result = parseModel(xmlText);
  if (result.error) return result;
  await saveModel(api, projectId, equipmentId, result.fcda, result.iedName);
  return result;
}

export async function loadIedModel(
  api: GitHubApi,
  projectId: string,
  equipmentId: string,
): Promise<IedFcda[] | null> {
  try {
    const { data } = await api.readJson<IedFcda[]>(modelPath(projectId, equipmentId));
    return data;
  } catch {
    return null;
  }
}
