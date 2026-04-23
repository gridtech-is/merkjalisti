// src/services/equipmentTemplateService.ts
import type { GitHubApi } from '../github/api';
import type { BaySignal, EquipmentTemplate, EquipmentTemplateSignal } from '../types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export interface EquipmentTemplateFile {
  template: EquipmentTemplate;
  sha: string;
}

function templatePath(id: string): string {
  return `data/equipment_templates/${id}.json`;
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

export { uuid, templatePath };
export type { EquipmentTemplateSignal };
