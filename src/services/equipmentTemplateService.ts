// src/services/equipmentTemplateService.ts
import type { GitHubApi } from '../github/api';
import type { BaySignal, EquipmentTemplate } from '../types';

export interface EquipmentTemplateFile {
  template: EquipmentTemplate;
  sha: string;
}

export async function listEquipmentTemplates(_api: GitHubApi): Promise<EquipmentTemplate[]> {
  return [];
}

export async function loadEquipmentTemplate(_api: GitHubApi, _id: string): Promise<EquipmentTemplateFile> {
  throw new Error('not implemented');
}

export async function saveEquipmentTemplate(
  _api: GitHubApi,
  _file: EquipmentTemplateFile,
  _isNew: boolean,
): Promise<EquipmentTemplateFile> {
  throw new Error('not implemented');
}

export async function deleteEquipmentTemplate(_api: GitHubApi, _id: string): Promise<void> {
  throw new Error('not implemented');
}

export async function createTemplateFromIED(
  _api: GitHubApi,
  _params: {
    name: string;
    edition: '1' | '2' | '2.1';
    manufacturer?: string;
    model?: string;
    description?: string;
    iedCode: string;
    baySignals: BaySignal[];
  },
): Promise<EquipmentTemplateFile> {
  throw new Error('not implemented');
}

export function applyTemplateToBay(
  _template: EquipmentTemplate,
  _iedCode: string,
  _baySignals: BaySignal[],
): { updated: BaySignal[]; matchedCount: number; skippedCount: number } {
  throw new Error('not implemented');
}

