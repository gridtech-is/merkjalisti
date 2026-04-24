# Plan 4 — Equipment templates með signal auto-populate

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gera kleift að vista IEC 61850 merkjamappingar sem tækjasniðmát og beita þeim sjálfkrafa á IED í reitum.

**Architecture:** Sniðmát vistuð sem einstakar JSON skrár í `data/equipment_templates/{uuid}.json` á GitHub. Product catalog (`data/equipment_templates.json`) er óbreytt og read-only. Þrjú entry point: "Gera sniðmát" í ProjectView (IED row) → vistunar-modal → `createTemplateFromIED`; "↓ Sniðmát" í BayView (IED chip) → `ApplyTemplateModal` → `applyTemplateToBay` (pure function); editor modal í LibraryView.

**Tech Stack:** React 18 + TypeScript + Vitest + Octokit (GitHubApi). CSS variables only — engin CSS modules.

---

## Skráaruppbygging

| Skrá | Aðgerð | Tilgangur |
|------|--------|-----------|
| `src/types.ts` | Modify | Bæta við `EquipmentTemplateSignal`, `iec61850_edition` + `signals[]` á `EquipmentTemplate` |
| `src/services/equipmentTemplateService.ts` | Create | CRUD + `createTemplateFromIED` + `applyTemplateToBay` |
| `src/services/equipmentTemplateService.test.ts` | Create | Unit testar fyrir pure functions og CRUD mock |
| `src/components/EquipmentTemplateEditor.tsx` | Create | Modal editor fyrir signal template |
| `src/components/ApplyTemplateModal.tsx` | Create | Modal til að velja og beita sniðmáti á IED í reit |
| `src/pages/LibraryView.tsx` | Modify | Sýna báðar gerðir sniðmáta, opna editor |
| `src/pages/BayView.tsx` | Modify | IED chips + "↓ Sniðmát" takki |
| `src/pages/ProjectView.tsx` | Modify | "⊕ Sniðmát" takki á IED row + save modal |

---

## Task 1: Types + service scaffold

**Files:**
- Modify: `src/types.ts`
- Create: `src/services/equipmentTemplateService.ts`

- [ ] **Skref 1: Bæta `EquipmentTemplateSignal` við `src/types.ts`**

Setja inn á eftir `EquipmentTemplate` skilgreiningunni (línu ~107):

```typescript
export interface EquipmentTemplateSignal {
  id: string;
  library_id: string;
  signal_name: string;
  ld_inst: string | null;
  prefix: string | null;
  ln_class: string | null;
  ln_inst: string | null;
  do_name: string | null;
  da_name: string | null;
}
```

- [ ] **Skref 2: Útvíkka `EquipmentTemplate` í `src/types.ts`**

Skipta um núverandi `EquipmentTemplate` interface:

```typescript
export interface EquipmentTemplate {
  id: string;
  name: string;
  category: EquipmentCategory;
  apparatus_type?: ApparatusType;
  manufacturer?: string;
  model?: string;
  description?: string;
  iec61850_edition?: '1' | '2' | '2.1';
  signals: EquipmentTemplateSignal[];
}
```

- [ ] **Skref 3: Búa til `src/services/equipmentTemplateService.ts` með scaffold**

```typescript
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

// Re-export so LibraryView can use it
export { uuid, templatePath };
```

- [ ] **Skref 4: Keyra build til að staðfesta TypeScript**

```bash
npm run build
```

Búist við: engar TypeScript villur. (Mögulega: warning um `templatePath` sem er ekki notað enn — OK.)

- [ ] **Skref 5: Commit**

```bash
git add src/types.ts src/services/equipmentTemplateService.ts
git commit -m "feat(plan4): EquipmentTemplateSignal gerð og service scaffold"
```

---

## Task 2: `applyTemplateToBay` + `createTemplateFromIED` + tests (TDD)

**Files:**
- Create: `src/services/equipmentTemplateService.test.ts`
- Modify: `src/services/equipmentTemplateService.ts`

- [ ] **Skref 1: Skrifa failing tests**

Búa til `src/services/equipmentTemplateService.test.ts`:

```typescript
// src/services/equipmentTemplateService.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  applyTemplateToBay,
  createTemplateFromIED,
} from './equipmentTemplateService';
import type { BaySignal, EquipmentTemplate } from '../types';

// ─── Hjálparföll ─────────────────────────────────────────────────────────────

function makeBaySignal(overrides: Partial<BaySignal> = {}): BaySignal {
  return {
    id: 'sig-1',
    equipment_code: 'Q0IED',
    signal_name: 'Pos.stVal',
    name_is: 'Staða',
    name_en: null,
    state_id: null,
    library_id: 'lib-1',
    iec61850_ied: null,
    iec61850_ln_prefix: null,
    iec61850_ln_inst: null,
    iec61850_rcb: null,
    iec61850_dataset_entry: null,
    iec61850_ld: null,
    iec61850_ln: null,
    iec61850_do: null,
    iec61850_da: null,
    iec61850_fc: null,
    iec61850_cdc: null,
    iec61850_dataset: null,
    is_alarm: false,
    alarm_class: null,
    state_alarm_map: null,
    source_type: 'IED',
    phase_added: 'DESIGN',
    fat_tested: false,
    fat_tested_by: null,
    fat_tested_at: null,
    fat_result: null,
    sat_tested: false,
    sat_tested_by: null,
    sat_tested_at: null,
    sat_result: null,
    review_flagged: false,
    review_comment: null,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<EquipmentTemplate> = {}): EquipmentTemplate {
  return {
    id: 'tmpl-1',
    name: 'Test template',
    category: 'ied',
    signals: [],
    ...overrides,
  };
}

// ─── applyTemplateToBay ───────────────────────────────────────────────────────

describe('applyTemplateToBay', () => {
  it('uppfærir IEC61850 á merki sem passa við library_id og equipment_code', () => {
    const template = makeTemplate({
      signals: [{
        id: 'ts-1',
        library_id: 'lib-1',
        signal_name: 'Pos.stVal',
        ld_inst: 'PROT',
        prefix: 'Q0',
        ln_class: 'XCBR',
        ln_inst: '1',
        do_name: 'Pos',
        da_name: 'stVal',
      }],
    });
    const signals = [makeBaySignal({ equipment_code: 'Q0IED', library_id: 'lib-1', signal_name: 'Pos.stVal' })];

    const { updated, matchedCount, skippedCount } = applyTemplateToBay(template, 'Q0IED', signals);

    expect(matchedCount).toBe(1);
    expect(skippedCount).toBe(0);
    expect(updated[0].iec61850_ld).toBe('PROT');
    expect(updated[0].iec61850_ln_prefix).toBe('Q0');
    expect(updated[0].iec61850_ln).toBe('XCBR');
    expect(updated[0].iec61850_ln_inst).toBe('1');
    expect(updated[0].iec61850_do).toBe('Pos');
    expect(updated[0].iec61850_da).toBe('stVal');
  });

  it('notar signal_name sem tiebreaker þegar fleiri en eitt merki passar við library_id', () => {
    const template = makeTemplate({
      signals: [
        { id: 'ts-1', library_id: 'lib-1', signal_name: 'Pos.stVal', ld_inst: 'PROT', prefix: null, ln_class: 'XCBR', ln_inst: '1', do_name: 'Pos', da_name: 'stVal' },
        { id: 'ts-2', library_id: 'lib-1', signal_name: 'Pos.q',     ld_inst: 'PROT', prefix: null, ln_class: 'XCBR', ln_inst: '1', do_name: 'Pos', da_name: 'q'    },
      ],
    });
    const signals = [
      makeBaySignal({ id: 'sig-a', equipment_code: 'Q0IED', library_id: 'lib-1', signal_name: 'Pos.stVal' }),
      makeBaySignal({ id: 'sig-b', equipment_code: 'Q0IED', library_id: 'lib-1', signal_name: 'Pos.q' }),
    ];

    const { updated, matchedCount } = applyTemplateToBay(template, 'Q0IED', signals);

    expect(matchedCount).toBe(2);
    const a = updated.find(s => s.id === 'sig-a')!;
    const b = updated.find(s => s.id === 'sig-b')!;
    expect(a.iec61850_da).toBe('stVal');
    expect(b.iec61850_da).toBe('q');
  });

  it('sleppir merkjum sem eru ekki í sniðmátinu', () => {
    const template = makeTemplate({ signals: [] });
    const signals = [makeBaySignal({ equipment_code: 'Q0IED', library_id: 'lib-1' })];

    const { updated, matchedCount, skippedCount } = applyTemplateToBay(template, 'Q0IED', signals);

    expect(matchedCount).toBe(0);
    expect(skippedCount).toBe(1);
    expect(updated[0].iec61850_ld).toBeNull();
  });

  it('snertir ekki merki með annan equipment_code', () => {
    const template = makeTemplate({
      signals: [{ id: 'ts-1', library_id: 'lib-1', signal_name: 'Pos.stVal', ld_inst: 'PROT', prefix: null, ln_class: 'XCBR', ln_inst: '1', do_name: 'Pos', da_name: 'stVal' }],
    });
    const signals = [makeBaySignal({ equipment_code: 'OTHER', library_id: 'lib-1' })];

    const { updated, matchedCount } = applyTemplateToBay(template, 'Q0IED', signals);

    expect(matchedCount).toBe(0);
    expect(updated[0].iec61850_ld).toBeNull();
  });

  it('setur do_name og da_name null þegar þau eru null í sniðmátinu', () => {
    const template = makeTemplate({
      signals: [{ id: 'ts-1', library_id: 'lib-1', signal_name: 'Pos.stVal', ld_inst: 'PROT', prefix: null, ln_class: 'XCBR', ln_inst: '1', do_name: null, da_name: null }],
    });
    const signals = [makeBaySignal({ equipment_code: 'Q0IED', library_id: 'lib-1', signal_name: 'Pos.stVal' })];

    const { updated } = applyTemplateToBay(template, 'Q0IED', signals);

    expect(updated[0].iec61850_do).toBeNull();
    expect(updated[0].iec61850_da).toBeNull();
  });
});

// ─── createTemplateFromIED ────────────────────────────────────────────────────

describe('createTemplateFromIED', () => {
  const mockApi = { writeJson: vi.fn(), readJson: vi.fn() };

  it('síar baySignals eftir equipment_code og fangar IEC61850 svæði', async () => {
    mockApi.writeJson.mockResolvedValue('sha-new');
    mockApi.readJson.mockRejectedValue(new Error('not found'));

    const baySignals: BaySignal[] = [
      makeBaySignal({
        id: 'sig-1', equipment_code: 'Q0IED', library_id: 'lib-1', signal_name: 'Pos.stVal',
        iec61850_ld: 'PROT', iec61850_ln_prefix: 'Q0', iec61850_ln: 'XCBR',
        iec61850_ln_inst: '1', iec61850_do: 'Pos', iec61850_da: 'stVal',
      }),
      makeBaySignal({ id: 'sig-2', equipment_code: 'OTHER', library_id: 'lib-2', signal_name: 'Foo' }),
    ];

    const { template } = await createTemplateFromIED(mockApi as never, {
      name: 'Siemens 7SA87',
      edition: '2',
      manufacturer: 'Siemens',
      model: '7SA87',
      iedCode: 'Q0IED',
      baySignals,
    });

    expect(template.signals).toHaveLength(1);
    const s = template.signals[0];
    expect(s.library_id).toBe('lib-1');
    expect(s.signal_name).toBe('Pos.stVal');
    expect(s.ld_inst).toBe('PROT');
    expect(s.prefix).toBe('Q0');
    expect(s.ln_class).toBe('XCBR');
    expect(s.ln_inst).toBe('1');
    expect(s.do_name).toBe('Pos');
    expect(s.da_name).toBe('stVal');
  });

  it('kastar villu ef merki vantar library_id', async () => {
    const baySignals: BaySignal[] = [
      makeBaySignal({ equipment_code: 'Q0IED', library_id: null }),
    ];

    await expect(
      createTemplateFromIED(mockApi as never, {
        name: 'Test', edition: '2', iedCode: 'Q0IED', baySignals,
      })
    ).rejects.toThrow('library_id');
  });

  it('skrifar template á réttan slóð', async () => {
    mockApi.writeJson.mockResolvedValue('sha-new');
    mockApi.readJson.mockRejectedValue(new Error('not found'));

    const { template } = await createTemplateFromIED(mockApi as never, {
      name: 'Test', edition: '2', iedCode: 'Q0IED',
      baySignals: [makeBaySignal({ equipment_code: 'Q0IED', library_id: 'lib-1' })],
    });

    expect(mockApi.writeJson).toHaveBeenCalledOnce();
    const [path] = mockApi.writeJson.mock.calls[0] as [string, unknown];
    expect(path).toBe(`data/equipment_templates/${template.id}.json`);
  });
});
```

- [ ] **Skref 2: Keyra tests til að staðfesta að þau falli**

```bash
npm test
```

Búist við: `applyTemplateToBay` og `createTemplateFromIED` tests falla með "not implemented".

- [ ] **Skref 3: Implementa `applyTemplateToBay` í `equipmentTemplateService.ts`**

Skipta um stub-ið:

```typescript
export function applyTemplateToBay(
  template: EquipmentTemplate,
  iedCode: string,
  baySignals: BaySignal[],
): { updated: BaySignal[]; matchedCount: number; skippedCount: number } {
  let matchedCount = 0;
  let skippedCount = 0;

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
    } else {
      skippedCount++;
    }
  }

  return { updated, matchedCount, skippedCount };
}
```

- [ ] **Skref 4: Implementa `createTemplateFromIED` í `equipmentTemplateService.ts`**

Skipta um stub-ið:

```typescript
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
```

- [ ] **Skref 5: Keyra tests til að staðfesta að þau standist**

```bash
npm test
```

Búist við: öll `applyTemplateToBay` og `createTemplateFromIED` tests standast.

- [ ] **Skref 6: Build check**

```bash
npm run build
```

Búist við: engar villur.

- [ ] **Skref 7: Commit**

```bash
git add src/services/equipmentTemplateService.ts src/services/equipmentTemplateService.test.ts
git commit -m "feat(plan4): applyTemplateToBay og createTemplateFromIED með TDD"
```

---

## Task 3: CRUD service functions + tests

**Files:**
- Modify: `src/services/equipmentTemplateService.ts`
- Modify: `src/services/equipmentTemplateService.test.ts`

- [ ] **Skref 1: Bæta CRUD tests við `equipmentTemplateService.test.ts`**

Bæta neðst við skrána:

```typescript
// ─── CRUD ─────────────────────────────────────────────────────────────────────

describe('listEquipmentTemplates', () => {
  it('skilar tóman lista þegar mappan er tóm eða til ekki', async () => {
    const { listEquipmentTemplates } = await import('./equipmentTemplateService');
    const api = { listDirectory: vi.fn().mockResolvedValue([]) };
    const result = await listEquipmentTemplates(api as never);
    expect(result).toEqual([]);
  });

  it('les hverja template skrá', async () => {
    const { listEquipmentTemplates } = await import('./equipmentTemplateService');
    const tmpl: EquipmentTemplate = { id: 'uuid-1', name: 'Test', category: 'ied', signals: [] };
    const api = {
      listDirectory: vi.fn().mockResolvedValue(['uuid-1.json']),
      readJson: vi.fn().mockResolvedValue({ data: tmpl, sha: 'sha1' }),
    };
    const result = await listEquipmentTemplates(api as never);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('uuid-1');
  });
});

describe('saveEquipmentTemplate', () => {
  it('skrifar nýtt template með sha=null', async () => {
    const { saveEquipmentTemplate } = await import('./equipmentTemplateService');
    const api = { writeJson: vi.fn().mockResolvedValue('sha-new') };
    const tmpl: EquipmentTemplate = { id: 'uuid-1', name: 'Test', category: 'ied', signals: [] };
    const file = { template: tmpl, sha: '' };

    const result = await saveEquipmentTemplate(api as never, file, true);

    expect(api.writeJson).toHaveBeenCalledWith(
      'data/equipment_templates/uuid-1.json',
      tmpl,
      null,
      expect.any(String),
    );
    expect(result.sha).toBe('sha-new');
  });

  it('skrifar með gildandi sha þegar uppfært', async () => {
    const { saveEquipmentTemplate } = await import('./equipmentTemplateService');
    const api = { writeJson: vi.fn().mockResolvedValue('sha-new') };
    const tmpl: EquipmentTemplate = { id: 'uuid-1', name: 'Test', category: 'ied', signals: [] };
    const file = { template: tmpl, sha: 'sha-old' };

    await saveEquipmentTemplate(api as never, file, false);

    expect(api.writeJson).toHaveBeenCalledWith(
      'data/equipment_templates/uuid-1.json',
      tmpl,
      'sha-old',
      expect.any(String),
    );
  });
});

describe('deleteEquipmentTemplate', () => {
  it('kallar á deleteFile með réttum slóð', async () => {
    const { deleteEquipmentTemplate } = await import('./equipmentTemplateService');
    const api = { deleteFile: vi.fn().mockResolvedValue(undefined) };
    await deleteEquipmentTemplate(api as never, 'uuid-1');
    expect(api.deleteFile).toHaveBeenCalledWith(
      'data/equipment_templates/uuid-1.json',
      expect.any(String),
      expect.any(String),
    );
  });
});
```

- [ ] **Skref 2: Keyra tests — staðfesta að þau falli**

```bash
npm test
```

Búist við: CRUD tests falla.

- [ ] **Skref 3: Implementa CRUD í `equipmentTemplateService.ts`**

Skipta um stubs-ina:

```typescript
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
```

- [ ] **Skref 4: Keyra tests**

```bash
npm test
```

Búist við: öll tests standast.

> **Athugið:** Ef `deleteFile` er ekki til í `GitHubApi` — athugaðu `src/github/api.ts`. Ef hún vantar, skoðaðu `writeJson` með sérstakri delete-payload (sha + `null` content) eða bættu `deleteFile` við api.ts.

- [ ] **Skref 5: Build check**

```bash
npm run build
```

- [ ] **Skref 6: Commit**

```bash
git add src/services/equipmentTemplateService.ts src/services/equipmentTemplateService.test.ts
git commit -m "feat(plan4): CRUD functions fyrir tækjasniðmát"
```

---

## Task 4: EquipmentTemplateEditor + Library integration

**Files:**
- Create: `src/components/EquipmentTemplateEditor.tsx`
- Modify: `src/pages/LibraryView.tsx`

- [ ] **Skref 1: Búa til `src/components/EquipmentTemplateEditor.tsx`**

```tsx
// src/components/EquipmentTemplateEditor.tsx
import { useState, useCallback } from 'react';
import { useApi } from '../context/ApiContext';
import { Button } from './ui';
import { saveEquipmentTemplate, deleteEquipmentTemplate, type EquipmentTemplateFile } from '../services/equipmentTemplateService';
import { useAutoCommit } from '../github/useAutoCommit';
import type { EquipmentTemplate, EquipmentTemplateSignal, SignalLibraryEntry } from '../types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const cell: React.CSSProperties = { padding: '4px 6px', borderBottom: '1px solid var(--line-muted)', fontSize: '12px' };
const head: React.CSSProperties = { ...cell, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--surface-alt)', whiteSpace: 'nowrap' };
const inp: React.CSSProperties = { width: '100%', background: 'transparent', border: 'none', fontSize: '12px', color: 'var(--text)', fontFamily: 'inherit', padding: '2px 4px' };

interface Props {
  file: EquipmentTemplateFile;
  library: SignalLibraryEntry[];
  onSaved: (updated: EquipmentTemplateFile) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}

export function EquipmentTemplateEditor({ file: initialFile, library, onSaved, onDeleted, onClose }: Props) {
  const { api } = useApi();
  const [file, setFile] = useState(initialFile);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const t = file.template;

  const patch = (updates: Partial<EquipmentTemplate>) => {
    setFile(f => ({ ...f, template: { ...f.template, ...updates } }));
    setIsDirty(true);
  };

  const patchSignal = (id: string, updates: Partial<EquipmentTemplateSignal>) => {
    patch({ signals: t.signals.map(s => s.id === id ? { ...s, ...updates } : s) });
  };

  const addSignal = () => {
    patch({ signals: [...t.signals, { id: uuid(), library_id: '', signal_name: '', ld_inst: null, prefix: null, ln_class: null, ln_inst: null, do_name: null, da_name: null }] });
  };

  const removeSignal = (id: string) => {
    patch({ signals: t.signals.filter(s => s.id !== id) });
  };

  const commit = useCallback(async () => {
    if (!isDirty) return;
    setSaving(true);
    try {
      const saved = await saveEquipmentTemplate(api, file, false);
      setFile(saved);
      setIsDirty(false);
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  }, [api, file, isDirty, onSaved]);

  useAutoCommit(isDirty, commit);

  const handleDelete = async () => {
    if (!confirm(`Eyða "${t.name}"? Þetta er óafturkræft.`)) return;
    await deleteEquipmentTemplate(api, t.id);
    onDeleted(t.id);
    onClose();
  };

  const libMap = new Map(library.map(e => [e.id, e]));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Breyta tækjasniðmáti</h2>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {isDirty && <Button size="sm" onClick={commit} disabled={saving}>Vista núna</Button>}
            {!isDirty && saving && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Vista...</span>}
            <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
          </div>
        </div>

        {/* Header fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          {([['name', 'Nafn'], ['manufacturer', 'Framleiðandi'], ['model', 'Líkan']] as [keyof EquipmentTemplate, string][]).map(([field, label]) => (
            <label key={field} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {label}
              <input
                style={{ display: 'block', width: '100%', marginTop: '2px', padding: '4px 8px', fontSize: '12px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
                defaultValue={(t[field] as string) ?? ''}
                onBlur={e => patch({ [field]: e.target.value || undefined })}
                onChange={() => {}}
              />
            </label>
          ))}
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            IEC útgáfa
            <select
              style={{ display: 'block', width: '100%', marginTop: '2px', padding: '4px 8px', fontSize: '12px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
              value={t.iec61850_edition ?? '2'}
              onChange={e => patch({ iec61850_edition: e.target.value as '1' | '2' | '2.1' })}
            >
              <option value="1">Ed 1</option>
              <option value="2">Ed 2</option>
              <option value="2.1">Ed 2.1</option>
            </select>
          </label>
        </div>
        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-4)' }}>
          Lýsing
          <textarea
            style={{ display: 'block', width: '100%', marginTop: '2px', padding: '4px 8px', fontSize: '12px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', resize: 'vertical', minHeight: '48px' }}
            defaultValue={t.description ?? ''}
            onBlur={e => patch({ description: e.target.value || undefined })}
            onChange={() => {}}
          />
        </label>

        {/* Signal table */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'auto', marginBottom: 'var(--space-3)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['', 'Library merki', 'Signal name', 'LD Inst', 'Prefix', 'LN Class', 'LN Inst', 'DO Name', 'DA Name'].map(h => (
                  <th key={h} style={head}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.signals.length === 0 && (
                <tr><td colSpan={9} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-6)' }}>Engin merki í sniðmátinu</td></tr>
              )}
              {t.signals.map((sig, i) => {
                const libEntry = libMap.get(sig.library_id);
                return (
                  <tr key={sig.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                    <td style={{ ...cell, width: '28px' }}>
                      <button type="button" onClick={() => removeSignal(sig.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '14px', padding: '0 4px' }}>✕</button>
                    </td>
                    <td style={{ ...cell, minWidth: '160px' }}>
                      <select
                        style={{ ...inp, minWidth: '150px' }}
                        value={sig.library_id}
                        onChange={e => {
                          const entry = library.find(l => l.id === e.target.value);
                          patchSignal(sig.id, {
                            library_id: e.target.value,
                            signal_name: entry ? (entry.iec61850_do ? `${entry.iec61850_do}${entry.iec61850_da ? '.' + entry.iec61850_da : ''}` : sig.signal_name) : sig.signal_name,
                            ln_class: entry?.iec61850_ln ?? sig.ln_class,
                            do_name: entry?.iec61850_do ?? sig.do_name,
                            da_name: entry?.iec61850_da ?? sig.da_name,
                          });
                        }}
                      >
                        <option value="">— Veldu merki —</option>
                        {library.map(e => (
                          <option key={e.id} value={e.id}>{e.code ? `${e.code} — ` : ''}{e.name_is}</option>
                        ))}
                      </select>
                    </td>
                    <td style={cell}><input style={inp} value={sig.signal_name} onChange={e => patchSignal(sig.id, { signal_name: e.target.value })} /></td>
                    <td style={cell}><input style={inp} value={sig.ld_inst ?? ''} onChange={e => patchSignal(sig.id, { ld_inst: e.target.value || null })} /></td>
                    <td style={cell}><input style={inp} value={sig.prefix ?? ''} onChange={e => patchSignal(sig.id, { prefix: e.target.value || null })} /></td>
                    <td style={cell}><input style={inp} value={sig.ln_class ?? ''} onChange={e => patchSignal(sig.id, { ln_class: e.target.value || null })} /></td>
                    <td style={cell}><input style={inp} value={sig.ln_inst ?? ''} onChange={e => patchSignal(sig.id, { ln_inst: e.target.value || null })} /></td>
                    <td style={cell}><input style={inp} value={sig.do_name ?? ''} onChange={e => patchSignal(sig.id, { do_name: e.target.value || null })} placeholder={libEntry?.iec61850_do ?? ''} /></td>
                    <td style={cell}><input style={inp} value={sig.da_name ?? ''} onChange={e => patchSignal(sig.id, { da_name: e.target.value || null })} placeholder={libEntry?.iec61850_da ?? ''} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button size="sm" variant="ghost" onClick={addSignal}>+ Bæta við línu</Button>
          <Button size="sm" variant="danger" onClick={handleDelete}>Eyða sniðmáti</Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Skref 2: Uppfæra `TemplatesTab` í `src/pages/LibraryView.tsx`**

Finna `TemplatesTab` fallið (línu ~858) og skipta um það:

```tsx
function TemplatesTab() {
  const { api } = useApi();
  const [eqCatalog, setEqCatalog] = useState<EquipmentTemplate[]>([]);
  const [eqSignalTemplates, setEqSignalTemplates] = useState<EquipmentTemplate[]>([]);
  const [bayTemplates, setBayTemplates] = useState<BayTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'equipment' | 'bay'>('equipment');
  const [editingFile, setEditingFile] = useState<EquipmentTemplateFile | null>(null);
  const [signalLibrary, setSignalLibrary] = useState<SignalLibraryEntry[]>([]);

  useEffect(() => {
    Promise.all([
      api.readJson<SignalLibraryEntry[]>('data/signal_library.json').catch(() => ({ data: [] as SignalLibraryEntry[], sha: '' })),
      api.readJson<EquipmentTemplate[]>('data/equipment_templates.json').catch(() => ({ data: [] as EquipmentTemplate[], sha: '' })),
      listEquipmentTemplates(api),
      listBayTemplates(api),
    ]).then(([{ data: lib }, { data: catalog }, signalTmpl, bay]) => {
      setSignalLibrary(lib);
      setEqCatalog(catalog.map(t => ({ signals: [], ...t })));
      setEqSignalTemplates(signalTmpl);
      setBayTemplates(bay);
    }).catch(() => {
      setLoadError('Villa við að hlaða sniðmátum. Reyndu aftur.');
    }).finally(() => setLoading(false));
  }, [api]);

  const handleNewTemplate = async () => {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    const template: EquipmentTemplate = { id, name: 'Nýtt sniðmát', category: 'ied', iec61850_edition: '2', signals: [] };
    const file = { template, sha: '' };
    try {
      const saved = await saveEquipmentTemplate(api, file, true);
      setEqSignalTemplates(prev => [...prev, saved.template]);
      setEditingFile(saved);
    } catch {
      alert('Villa við að búa til sniðmát. Reyndu aftur.');
    }
  };

  const cell: React.CSSProperties = { padding: '5px 8px', borderBottom: '1px solid var(--line-muted)', fontSize: '12px' };
  const head: React.CSSProperties = { ...cell, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--surface-alt)', whiteSpace: 'nowrap' };

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;
  if (loadError) return <p style={{ color: 'var(--danger)' }}>{loadError}</p>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {([['equipment', `Tækjasniðmát (${eqCatalog.length + eqSignalTemplates.length})`], ['bay', `Reitsniðmát (${bayTemplates.length})`]] as ['equipment' | 'bay', string][]).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setSubTab(id)}
            style={{
              background: subTab === id ? 'var(--accent)' : 'var(--surface-alt)',
              color: subTab === id ? 'white' : 'var(--text-secondary)',
              border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
              padding: '5px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            }}>{label}</button>
        ))}
      </div>

      {subTab === 'equipment' && (
        <>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <button type="button" onClick={handleNewTemplate}
              style={{ padding: '5px 14px', fontSize: '12px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
              + Nýtt signal-sniðmát
            </button>
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Nafn', 'Gerð', 'Framleiðandi', 'Líkan', 'Lýsing'].map(h => <th key={h} style={head}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {eqCatalog.length === 0 && eqSignalTemplates.length === 0 && (
                  <tr><td colSpan={5} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-8)' }}>Engin tækjasniðmát</td></tr>
                )}
                {eqCatalog.map((t, i) => (
                  <tr key={t.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                    <td style={{ ...cell, fontWeight: 600 }}>{t.name}</td>
                    <td style={{ ...cell }}>
                      <span style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: '999px', color: 'var(--text-secondary)' }}>Product catalog</span>
                    </td>
                    <td style={cell}>{t.manufacturer ?? '—'}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px' }}>{t.model ?? '—'}</td>
                    <td style={{ ...cell, color: 'var(--muted)' }}>{t.description ?? '—'}</td>
                  </tr>
                ))}
                {eqSignalTemplates.map((t, i) => (
                  <tr key={t.id}
                    style={{ background: i % 2 === 0 ? 'var(--bg-subtle)' : 'transparent', cursor: 'pointer' }}
                    onClick={async () => {
                      try {
                        const loaded = await loadEquipmentTemplate(api, t.id);
                        setEditingFile(loaded);
                      } catch {
                        alert('Villa við að hlaða sniðmáti. Reyndu aftur.');
                      }
                    }}
                  >
                    <td style={{ ...cell, fontWeight: 600 }}>{t.name}</td>
                    <td style={cell}>
                      <span style={{ fontSize: '10px', padding: '2px 6px', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', border: '1px solid var(--accent)', borderRadius: '999px', color: 'var(--accent)' }}>
                        Sniðmát{t.iec61850_edition ? ` Ed${t.iec61850_edition}` : ''} · {t.signals.length} merki
                      </span>
                    </td>
                    <td style={cell}>{t.manufacturer ?? '—'}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px' }}>{t.model ?? '—'}</td>
                    <td style={{ ...cell, color: 'var(--muted)' }}>{t.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {subTab === 'bay' && (
        // ... óbreytt bay template tafla — halda þeirri kóða
        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Nafn', 'Display ID', 'Merki', 'Tæki'].map(h => <th key={h} style={head}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {bayTemplates.length === 0 && (
                <tr><td colSpan={4} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-8)' }}>Engin reitsniðmát</td></tr>
              )}
              {bayTemplates.map((t, i) => (
                <tr key={t.template_name} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                  <td style={{ ...cell, fontWeight: 600 }}>{t.template_name}</td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px' }}>{t.display_id}</td>
                  <td style={cell}>{t.signals.length}</td>
                  <td style={cell}>{t.equipment_codes.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingFile && (
        <EquipmentTemplateEditor
          file={editingFile}
          library={signalLibrary}
          onSaved={updated => {
            setEqSignalTemplates(prev => prev.map(t => t.id === updated.template.id ? updated.template : t));
            setEditingFile(updated);
          }}
          onDeleted={id => setEqSignalTemplates(prev => prev.filter(t => t.id !== id))}
          onClose={() => setEditingFile(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Skref 3: Bæta við imports í `LibraryView.tsx`**

Bæta við efst í LibraryView.tsx import section:

```typescript
import { listEquipmentTemplates, loadEquipmentTemplate, saveEquipmentTemplate, type EquipmentTemplateFile } from '../services/equipmentTemplateService';
import { EquipmentTemplateEditor } from '../components/EquipmentTemplateEditor';
```

Einnig þarf `SignalLibraryEntry` í type import ef hann er ekki þar þegar.

- [ ] **Skref 4: Keyra build og tests**

```bash
npm run build && npm test
```

Búist við: engar villur.

- [ ] **Skref 5: Commit**

```bash
git add src/components/EquipmentTemplateEditor.tsx src/pages/LibraryView.tsx
git commit -m "feat(plan4): EquipmentTemplateEditor modal og Library uppfærsla"
```

---

## Task 5: ApplyTemplateModal + BayView integration

**Files:**
- Create: `src/components/ApplyTemplateModal.tsx`
- Modify: `src/pages/BayView.tsx`

- [ ] **Skref 1: Búa til `src/components/ApplyTemplateModal.tsx`**

```tsx
// src/components/ApplyTemplateModal.tsx
import { useState } from 'react';
import { Button } from './ui';
import { applyTemplateToBay } from '../services/equipmentTemplateService';
import type { BaySignal, Equipment, EquipmentTemplate } from '../types';

interface Props {
  ied: Equipment;
  templates: EquipmentTemplate[];
  baySignals: BaySignal[];
  onApply: (updated: BaySignal[], matchedCount: number) => void;
  onClose: () => void;
}

export function ApplyTemplateModal({ ied, templates, baySignals, onApply, onClose }: Props) {
  const [selected, setSelected] = useState<string>('');

  const matchingTemplates = templates.filter(
    t => t.category === 'ied' && t.signals.length > 0 && (
      !ied.model || !t.model || t.model.toLowerCase().includes(ied.model.toLowerCase()) || ied.model.toLowerCase().includes(t.model.toLowerCase())
    )
  );
  const displayTemplates = matchingTemplates.length > 0 ? matchingTemplates : templates.filter(t => t.category === 'ied' && t.signals.length > 0);

  const selectedTemplate = displayTemplates.find(t => t.id === selected);
  const preview = selectedTemplate
    ? applyTemplateToBay(selectedTemplate, ied.code, baySignals)
    : null;

  const handleApply = () => {
    if (!selectedTemplate || !preview) return;
    onApply(preview.updated, preview.matchedCount);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: '480px', maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Beita sniðmáti á {ied.code}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
        </div>

        {displayTemplates.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Engin signal-sniðmát fundust. Búðu til sniðmát í Merkjasafni fyrst.</p>
        ) : (
          <>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Veldu sniðmát</label>
              <select
                style={{ width: '100%', padding: '6px 8px', fontSize: '13px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
                value={selected}
                onChange={e => setSelected(e.target.value)}
              >
                <option value="">— Veldu —</option>
                {displayTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}{t.iec61850_edition ? ` (Ed ${t.iec61850_edition})` : ''} · {t.signals.length} merki</option>
                ))}
              </select>
            </div>

            {preview && (
              <div style={{ fontSize: '13px', marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--surface-alt)', borderRadius: 'var(--radius-sm)', color: preview.matchedCount > 0 ? 'var(--text)' : 'var(--muted)' }}>
                {preview.matchedCount > 0
                  ? `Mun uppfæra IEC61850 á ${preview.matchedCount} merkjum í reitnum`
                  : `0 af ${baySignals.filter(s => s.equipment_code === ied.code).length} merkjum passaði`
                }
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button size="sm" variant="ghost" onClick={onClose}>Hætta við</Button>
              <Button size="sm" onClick={handleApply} disabled={!selected || !preview || preview.matchedCount === 0}>Beita</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Skref 2: Bæta signal templates loading við `BayView.tsx`**

Í `BayView` — bæta við state og load:

```typescript
// Bæta við state (með öðrum useState calls):
const [signalTemplates, setSignalTemplates] = useState<EquipmentTemplate[]>([]);
const [applyTemplateIed, setApplyTemplateIed] = useState<Equipment | null>(null);
```

Í `useEffect` þar sem gögn eru hlaðin, bæta við í `Promise.all`:

```typescript
listEquipmentTemplates(api).then(setSignalTemplates).catch(() => {});
```

- [ ] **Skref 3: Bæta IED chip section við í `BayView.tsx`**

Þetta kemur rétt á undan `<SignalTable` (línu ~473). Finna þá línu og bæta þessu við á undan:

```tsx
{/* IED chips — sýna IED tæki sem tilheyra þessum reit */}
{(() => {
  const bayIeds = allEquipment.filter(eq => eq.category === 'ied' && bay.equipment_ids.includes(eq.id));
  if (bayIeds.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
      {bayIeds.map(eq => (
        <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid var(--accent)', borderRadius: '999px', fontSize: '12px' }}>
          <span style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>{eq.code}</span>
          {eq.manufacturer && <span style={{ color: 'var(--text-secondary)' }}>{eq.manufacturer}</span>}
          {eq.model && <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '11px' }}>{eq.model}</span>}
          {isDraftStatus && (
            <button
              type="button"
              onClick={() => setApplyTemplateIed(eq)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '11px', padding: '0 2px', fontFamily: 'inherit' }}
              title="Beita IEC 61850 sniðmáti"
            >↓ Sniðmát</button>
          )}
        </div>
      ))}
    </div>
  );
})()}
```

- [ ] **Skref 4: Bæta ApplyTemplateModal við í `BayView.tsx`**

Neðst í JSX return, á eftir öðrum modals:

```tsx
{applyTemplateIed && (
  <ApplyTemplateModal
    ied={applyTemplateIed}
    templates={signalTemplates}
    baySignals={bay.signals}
    onApply={(updated, matchedCount) => {
      setBayFile(prev => prev ? { ...prev, bay: { ...prev.bay, signals: updated } } : prev);
      setIsDirty(true);
      alert(`Uppfærði IEC61850 á ${matchedCount} merkjum.`);
    }}
    onClose={() => setApplyTemplateIed(null)}
  />
)}
```

- [ ] **Skref 5: Bæta við imports í `BayView.tsx`**

```typescript
import { listEquipmentTemplates } from '../services/equipmentTemplateService';
import { ApplyTemplateModal } from '../components/ApplyTemplateModal';
import type { EquipmentTemplate } from '../types';
```

- [ ] **Skref 6: Build og test**

```bash
npm run build && npm test
```

- [ ] **Skref 7: Commit**

```bash
git add src/components/ApplyTemplateModal.tsx src/pages/BayView.tsx
git commit -m "feat(plan4): ApplyTemplateModal og IED chips í BayView"
```

---

## Task 6: "Gera sniðmát" modal + ProjectView integration

**Files:**
- Modify: `src/pages/ProjectView.tsx`

- [ ] **Skref 1: Bæta SaveTemplateModal component við í `ProjectView.tsx`**

Bæta þessu falli við rétt á undan `export function ProjectView()`:

```tsx
interface SaveTemplateModalProps {
  ied: Equipment;
  allBaySignals: BaySignal[];
  onSaved: () => void;
  onClose: () => void;
}

function SaveTemplateModal({ ied, allBaySignals, onSaved, onClose }: SaveTemplateModalProps) {
  const { api } = useApi();
  const [name, setName] = useState(`${ied.manufacturer ?? ''} ${ied.model ?? ''}`.trim() || ied.code);
  const [edition, setEdition] = useState<'1' | '2' | '2.1'>('2');
  const [description, setDescription] = useState(ied.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matching = allBaySignals.filter(s => s.equipment_code === ied.code);
  const bayCount = new Set(matching.map(s => s.id.split(':')[0])).size;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await createTemplateFromIED(api, {
        name,
        edition,
        manufacturer: ied.manufacturer ?? undefined,
        model: ied.model ?? undefined,
        description: description || undefined,
        iedCode: ied.code,
        baySignals: allBaySignals,
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('library_id')) {
        setError('Sniðmát geta ekki innihaldið sérsniðin merki. Vinsamlegast tengdu öll merkin við Merkjasafn fyrst.');
      } else {
        setError('Villa við vistun. Reyndu aftur.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: '440px', maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Gera tækjasniðmát</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-secondary)' }}>✕</button>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: 'var(--space-4)' }}>
          Safnað {matching.length} merkjum úr {bayCount} reit(um) með kóðann <strong>{ied.code}</strong>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Nafn sniðmáts
            <input
              style={{ display: 'block', width: '100%', marginTop: '2px', padding: '6px 8px', fontSize: '13px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </label>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            IEC 61850 útgáfa
            <select
              style={{ display: 'block', width: '100%', marginTop: '2px', padding: '6px 8px', fontSize: '13px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
              value={edition}
              onChange={e => setEdition(e.target.value as '1' | '2' | '2.1')}
            >
              <option value="1">Ed 1</option>
              <option value="2">Ed 2</option>
              <option value="2.1">Ed 2.1</option>
            </select>
          </label>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Lýsing
            <textarea
              style={{ display: 'block', width: '100%', marginTop: '2px', padding: '6px 8px', fontSize: '13px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', resize: 'vertical', minHeight: '60px' }}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </label>
        </div>

        {error && <p style={{ fontSize: '12px', color: 'var(--danger)', marginBottom: 'var(--space-3)' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <button type="button" onClick={onClose} style={{ padding: '6px 14px', fontSize: '13px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text)' }}>Hætta við</button>
          <button type="button" onClick={handleSave} disabled={saving || !name.trim() || matching.length === 0}
            style={{ padding: '6px 14px', fontSize: '13px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', opacity: (saving || !name.trim() || matching.length === 0) ? 0.5 : 1 }}>
            {saving ? 'Vistar...' : 'Vista'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Skref 2: Bæta state og all-bay-signals loading við í `ProjectView`**

Í `ProjectView` fallinu, bæta við state:

```typescript
const [saveTemplateIed, setSaveTemplateIed] = useState<Equipment | null>(null);
const [allBaySignals, setAllBaySignals] = useState<BaySignal[]>([]);
```

Í `useEffect` (línu ~137 í ProjectView.tsx), rétt á eftir `setBays(bayList)`:

```typescript
setBays(bayList);
setAllBaySignals(bayList.flatMap(b => b.signals)); // ← bæta við
```

- [ ] **Skref 3: Bæta "⊕ Sniðmát" takka við IED row í ProjectView**

Í IED row action cell (línu ~719-734), bæta eftirfarandi á eftir ICD upload label og á undan Eyða takka:

```tsx
{allBaySignals.some(s => s.equipment_code === eq.code) && (
  <button
    type="button"
    onClick={() => setSaveTemplateIed(eq)}
    style={{
      display: 'inline-block', padding: '3px 8px', fontSize: '11px',
      border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
      cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)',
      whiteSpace: 'nowrap',
    }}
    title="Gera tækjasniðmát úr þessum IED"
  >
    ⊕ Sniðmát
  </button>
)}
```

- [ ] **Skref 4: Bæta SaveTemplateModal við í JSX return**

Neðst í JSX return (á eftir ImportScdModal eða seinasta modal):

```tsx
{saveTemplateIed && (
  <SaveTemplateModal
    ied={saveTemplateIed}
    allBaySignals={allBaySignals}
    onSaved={() => {}}
    onClose={() => setSaveTemplateIed(null)}
  />
)}
```

- [ ] **Skref 5: Bæta við imports í `ProjectView.tsx`**

```typescript
import { createTemplateFromIED } from '../services/equipmentTemplateService';
import type { BaySignal } from '../types';
```

(Athugaðu hvort `BaySignal` er þegar í imports — ef svo er, sleppa þv)

- [ ] **Skref 6: Build og test**

```bash
npm run build && npm test
```

- [ ] **Skref 7: Commit**

```bash
git add src/pages/ProjectView.tsx
git commit -m "feat(plan4): Gera sniðmát modal og takki í IED row í ProjectView"
```

---

## Task 7: Reykpróf handvirkt

- [ ] **Skref 1: Keyra dev server**

```bash
npm run dev
```

Opna `http://localhost:5173/merkjalisti/`

- [ ] **Skref 2: Library — Nýtt sniðmát**

1. Fara í Merkjasafn → Sniðmát → Tækjasniðmát
2. Smella "+ Nýtt signal-sniðmát"
3. Sniðmát birtist í lista, click opnar editor modal
4. Breyta nafni, bæta við merki, velja library entry
5. Vista — staðfesta að þær séu vistaðar (30s auto-commit eða "Vista núna")
6. "Eyða sniðmáti" — staðfesta að þess sé eytt og modal lokar

- [ ] **Skref 3: ProjectView — "Gera sniðmát"**

1. Fara í verkefni með IED sem hefur merki í reitum
2. IED row á að sýna "⊕ Sniðmát" takka
3. Smella → modal opnast með formi
4. Fylla út nafn + edition, smella "Vista"
5. Fara í Merkjasafn → Sniðmát → nýja sniðmátið á að vera þar

- [ ] **Skref 4: BayView — "↓ Sniðmát"**

1. Fara í reit með IED
2. IED chip á að birtast ofan við merkatöfluna
3. "↓ Sniðmát" takki á chip — smella
4. Modal opnast með lista af sniðmátum
5. Velja sniðmát → preview count birtist
6. "Beita" → toast + IEC svæði uppfærð á merkjunum

- [ ] **Skref 5: Lokabuild**

```bash
npm run build && npm test
```

Búist við: engar villur, öll tests standast.

---

## Viðauki: `deleteFile` í GitHubApi

Ef `api.deleteFile` er ekki til í `src/github/api.ts`, þarf að bæta henni við. Skoðaðu skrána og bættu við:

```typescript
async deleteFile(path: string, sha: string, message: string): Promise<void> {
  await this.octokit.repos.deleteFile({
    owner: this.config.owner,
    repo: this.config.repo,
    path,
    message,
    sha,
  });
}
```
