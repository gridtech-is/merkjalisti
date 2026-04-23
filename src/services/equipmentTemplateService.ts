// src/services/equipmentTemplateService.ts
import type { GitHubApi } from '../github/api';
import type { BaySignal, EquipmentTemplate, EquipmentTemplateSignal } from '../types';

export interface EquipmentTemplateFile {
  template: EquipmentTemplate;
  sha: string;
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function templatePath(id: string): string {
  return `data/equipment_templates/${id}.json`;
}

export async function listEquipmentTemplates(api: GitHubApi): Promise<EquipmentTemplate[]> {
  let entries: string[];
  try {
    entries = await api.listDirectory('data/equipment_templates');
  } catch {
    return [];
  }
  const jsonFiles = entries.filter(e => e.endsWith('.json'));
  const results = await Promise.allSettled(
    jsonFiles.map(f => api.readJson<EquipmentTemplate>(`data/equipment_templates/${f}`))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<{ data: EquipmentTemplate; sha: string }> => r.status === 'fulfilled')
    .map(r => r.value.data);
}

export async function loadEquipmentTemplate(api: GitHubApi, id: string): Promise<EquipmentTemplateFile> {
  const { data, sha } = await api.readJson<EquipmentTemplate>(templatePath(id));
  return { template: data, sha };
}

export async function saveEquipmentTemplate(
  api: GitHubApi,
  file: EquipmentTemplateFile,
  isNew: boolean,
): Promise<EquipmentTemplateFile> {
  const sha = await api.writeJson(
    templatePath(file.template.id),
    file.template,
    isNew ? null : file.sha,
    `Uppfærsla tækjasniðmáts: ${file.template.name}`,
  );
  return { ...file, sha };
}

export async function deleteEquipmentTemplate(api: GitHubApi, id: string): Promise<void> {
  const { sha } = await api.readJson<EquipmentTemplate>(templatePath(id));
  await api.deleteFile(
    templatePath(id),
    sha,
    `Eyða tækjasniðmáti: ${id}`,
  );
}

export async function createTemplateFromIED(
  api: GitHubApi,
  params: {
    name: string;
    edition: '1' | '2' | '2.1';
    manufacturer?: string;
    model?: string;
    description?: string;
    iedCode: string;
    baySignals: BaySignal[];
  },
): Promise<EquipmentTemplateFile> {
  const matched = params.baySignals.filter(s => s.equipment_code === params.iedCode);
  for (const sig of matched) {
    if (!sig.library_id) {
      throw new Error(`Merki "${sig.signal_name}" vantar library_id — tengdu það við Merkjasafn fyrst.`);
    }
  }

  const signals: EquipmentTemplateSignal[] = matched.map(sig => ({
    id: uuid(),
    library_id: sig.library_id!,
    signal_name: sig.signal_name,
    ld_inst: sig.iec61850_ld,
    prefix: sig.iec61850_ln_prefix,
    ln_class: sig.iec61850_ln,
    ln_inst: sig.iec61850_ln_inst,
    do_name: sig.iec61850_do,
    da_name: sig.iec61850_da,
  }));

  const id = uuid();
  const template: EquipmentTemplate = {
    id,
    name: params.name,
    category: 'ied',
    manufacturer: params.manufacturer,
    model: params.model,
    description: params.description,
    iec61850_edition: params.edition,
    signals,
  };

  let existingSha: string | null = null;
  try {
    const existing = await api.readJson<EquipmentTemplate>(templatePath(id));
    existingSha = existing.sha;
  } catch { /* ný skrá */ }

  const sha = await api.writeJson(
    templatePath(id),
    template,
    existingSha,
    `Nýtt tækjasniðmát: ${template.name}`,
  );

  return { template, sha };
}

export function applyTemplateToBay(
  template: EquipmentTemplate,
  iedCode: string,
  baySignals: BaySignal[],
): { updated: BaySignal[]; matchedCount: number; skippedCount: number } {
  let matchedCount = 0;
  const matchedIds = new Set<string>();

  const updated = baySignals.map(sig => ({ ...sig }));

  for (const ts of template.signals) {
    const candidates = updated.filter(
      s => s.equipment_code === iedCode && s.library_id === ts.library_id
    );
    const match = candidates.length > 1
      ? candidates.find(s => s.signal_name === ts.signal_name) ?? null
      : candidates[0] ?? null;

    if (match) {
      match.iec61850_ld = ts.ld_inst;
      match.iec61850_ln_prefix = ts.prefix;
      match.iec61850_ln = ts.ln_class;
      match.iec61850_ln_inst = ts.ln_inst;
      match.iec61850_do = ts.do_name;
      match.iec61850_da = ts.da_name;
      matchedCount++;
      matchedIds.add(match.id);
    }
  }

  const skippedCount = updated.filter(
    s => s.equipment_code === iedCode && !matchedIds.has(s.id)
  ).length;

  return { updated, matchedCount, skippedCount };
}
