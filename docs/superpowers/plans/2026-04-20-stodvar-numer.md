# Stöðvar-númer á verkefni — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bæta `station_number` við `Project`, fjarlægja `Bay.station` / `BayTemplate.station` svo stöðvar-númer er skráð einu sinni og notað alls staðar í verkefninu.

**Architecture:** `Project.station_number: string` verður single source of truth. `Bay.station` fjarlægt úr type og úr öllum notkunum. `Bay.display_id` heldur áfram sem stored field en er endurreiknað úr `project.station_number` + `bay.bay_name` við sköpun og þegar `station_number` breytist (cascade til allra bays).

**Tech Stack:** TypeScript, React 18, Vite, Vitest, React Router v6, Octokit (GitHub REST API).

**Spec:** `docs/superpowers/specs/2026-04-20-stodvar-numer-design.md`

---

## File Structure

**Modified:**
- `src/types.ts` — `Project` gets `station_number`, `Bay.station` removed, `BayTemplate.station` removed
- `src/services/projectService.ts` — `createProject` tekur `stationNumber` arg
- `src/services/projectService.test.ts` — uppfærð test, nýtt test fyrir stationNumber
- `src/services/bayService.ts` — `createBay` signature óbreytt en færir í stað `station` arg nafnið `stationNumber` (semantics), fjarlægir `station:` úr Bay object og `saveBayTemplate`
- `src/services/bayService.test.ts` — uppfærð test
- `src/pages/NewProject.tsx` — bæta við station_number input
- `src/pages/NewBay.tsx` — fjarlægja station input, hlaða project fyrir station_number
- `src/pages/BayView.tsx` — hlaða project til að sýna station_number í breadcrumb
- `src/pages/ProjectView.tsx` — bæta við station_number edit + cascade logic fyrir display_id

**No new files.**

---

## Task 1: Bæta `station_number` við Project type og createProject service

**Files:**
- Modify: `src/types.ts:57-64`
- Modify: `src/services/projectService.ts:27-68`
- Modify: `src/services/projectService.test.ts:54-77` (existing test needs updated signature)
- Test: `src/services/projectService.test.ts` (new test)

- [ ] **Step 1: Uppfæra existing `createProject` test til að expect-a nýja signature (failing)**

Í `src/services/projectService.test.ts`, skipta út línu 54–77 með:

```ts
describe('createProject', () => {
  it('writes project.json, equipment.json, station_signals.json, changelog.json, testing.json', async () => {
    mockApi.writeJson.mockResolvedValue('sha123');

    const result = await createProject(
      mockApi as never,
      'Hamrahlíð 66kV',
      '55',
      'Teddi'
    );

    expect(mockApi.writeJson).toHaveBeenCalledTimes(5);
    const paths = mockApi.writeJson.mock.calls.map((c: unknown[]) => c[0]);
    expect(paths.some((p: string) => p.endsWith('project.json'))).toBe(true);
    expect(paths.some((p: string) => p.endsWith('equipment.json'))).toBe(true);
    expect(paths.some((p: string) => p.endsWith('station_signals.json'))).toBe(true);
    expect(paths.some((p: string) => p.endsWith('changelog.json'))).toBe(true);
    expect(paths.some((p: string) => p.endsWith('testing.json'))).toBe(true);

    expect(result.project.name).toBe('Hamrahlíð 66kV');
    expect(result.project.station_number).toBe('55');
    expect(result.project.phase).toBe('DESIGN');
    expect(result.project.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.stationSignals).toEqual({ status: 'DRAFT', review: null, signals: [] });
  });

  it('requires non-empty stationNumber', async () => {
    await expect(
      createProject(mockApi as never, 'X', '', 'Teddi')
    ).rejects.toThrow(/station_number/i);
  });
});
```

- [ ] **Step 2: Keyra test — á að fallera**

Run: `npm test -- projectService`
Expected: FAIL — „Expected 3 arguments, but got 4" og/eða missing `station_number`.

- [ ] **Step 3: Uppfæra `Project` type**

Í `src/types.ts`, línur 57–64, skipta út:

```ts
export interface Project {
  id: string;
  name: string;
  station_number: string;
  description: string;
  created: string;
  phase: ProjectPhase;
  review: ProjectReview | null;
}
```

- [ ] **Step 4: Uppfæra `createProject` signature + implementation**

Í `src/services/projectService.ts`, línur 27–46 (aðeins `createProject` hausnum og `project` uppsetningu), skipta út:

```ts
export async function createProject(
  api: GitHubApi,
  name: string,
  stationNumber: string,
  createdBy: string
): Promise<ProjectFiles> {
  if (!stationNumber.trim()) {
    throw new Error('station_number er skylt');
  }
  const id = uuid();
  const now = new Date().toISOString();
  const base = `projects/${id}`;

  const project: Project = {
    id,
    name,
    station_number: stationNumber,
    description: '',
    created: now,
    phase: 'DESIGN',
    review: null,
  };
```

Restur fallsins er óbreyttur (línur 39–68 halda sér).

- [ ] **Step 5: Laga `loadProject` legacy test (línur 22–51) — bæta við `station_number` í mock data**

Í `src/services/projectService.test.ts`, línur 26 og 42, skipta út `data: { id: 'p1', name: 'X', description: '', created: '', phase: 'DESIGN', review: null }` með:

```ts
data: { id: 'p1', name: 'X', station_number: '55', description: '', created: '', phase: 'DESIGN', review: null }
```

Og í línu 91 og 107, skipta út svipað:

```ts
data: { id: projectId, name: 'Test Station', station_number: '55', phase: 'DESIGN', description: '', created: '2026-01-01T00:00:00Z', review: null }
```

og línu 107:

```ts
.mockResolvedValueOnce({ data: { id: projectId, name: 'X', station_number: '55', phase: 'DESIGN', description: '', created: '2026-01-01T00:00:00Z', review: null }, sha: 's1' })
```

- [ ] **Step 6: Keyra test — allt á að passa**

Run: `npm test -- projectService`
Expected: PASS, öll test í `projectService.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/services/projectService.ts src/services/projectService.test.ts
git commit -m "Bæta station_number við Project og createProject"
```

---

## Task 2: Uppfæra NewProject UI með station_number reit

**Files:**
- Modify: `src/pages/NewProject.tsx:12-101`

- [ ] **Step 1: Bæta við state + uppfæra handleCreate**

Í `src/pages/NewProject.tsx`, bæta við `stationNumber` state (línu 17 eftir `name`):

```tsx
  const [name, setName] = useState('');
  const [stationNumber, setStationNumber] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
```

Uppfæra `handleCreate` (línur 21–35) — kallið í `createProject` verður:

```tsx
  const handleCreate = async () => {
    if (!name.trim() || !stationNumber.trim()) return;
    setSaving(true);
    setError('');
    try {
      const files = await createProject(api, name.trim(), stationNumber.trim(), userName);
      if (equipment.length > 0) {
        await saveProject(api, { ...files, equipment });
      }
      navigate(`/projects/${files.project.id}`);
    } catch {
      setError('Villa við að búa til verkefni. Reyndu aftur.');
      setSaving(false);
    }
  };
```

- [ ] **Step 2: Bæta við input-reit í UI + virkja validation**

Í `src/pages/NewProject.tsx`, línur 63–82 (step `name` blokkina), skipta út með:

```tsx
        {step === 'name' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <Input
              label="Heiti dreifistöðvar / stöðvar"
              value={name}
              onChange={setName}
              placeholder="t.d. Hamrahlíð 66kV"
              required
            />
            <Input
              label="Stöðvar númer"
              value={stationNumber}
              onChange={v => setStationNumber(v.replace(/\D/g, '').slice(0, 10))}
              placeholder="t.d. 55"
              required
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <Button variant="ghost" onClick={() => navigate('/')}>Hætta við</Button>
              <Button
                onClick={() => setStep('equipment')}
                disabled={!name.trim() || !stationNumber.trim()}
              >
                Áfram →
              </Button>
            </div>
          </div>
        )}
```

Athugasemd: Regex `replace(/\D/g, '')` síar út ekki-tölustafi strax við inntak — UI tryggir að bara tölur berist.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`
Opna http://localhost:5173/merkjalisti/, fara í „Nýtt verkefni", staðfesta:
- Tveir input reitir
- Bókstafir í númer eru síaðir út
- Áfram takki disabled ef annar reitur er auður
Loka dev server með Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/pages/NewProject.tsx
git commit -m "Bæta station_number reit í Nýtt verkefni flæði"
```

---

## Task 3: Fjarlægja `Bay.station` og `BayTemplate.station` úr types

**Files:**
- Modify: `src/types.ts:172-182` (Bay)
- Modify: `src/types.ts:242-250` (BayTemplate)
- Modify: `src/services/bayService.ts:18-47` (createBay) og `93-114` (saveBayTemplate)
- Modify: `src/services/bayService.test.ts:14-47`

- [ ] **Step 1: Uppfæra `createBay` test (failing)**

Í `src/services/bayService.test.ts`, línur 14–47, skipta út með:

```ts
describe('createBay', () => {
  it('writes bay json with station_number-derived display_id', async () => {
    mockApi.writeJson.mockResolvedValue('sha1');
    const result = await createBay(mockApi as never, 'proj-123', '55', 'J', 'E00', [], 'Teddi');

    expect(mockApi.writeJson).toHaveBeenCalledOnce();
    const [path, data] = mockApi.writeJson.mock.calls[0] as [string, Bay];
    expect(path).toMatch(/^projects\/proj-123\/bays\//);
    expect(data.display_id).toBe('55E00');
    expect(data.bay_name).toBe('E00');
    // station field should no longer exist
    expect('station' in data).toBe(false);
  });
});

describe('listBays', () => {
  it('returns empty array when no bays directory entries', async () => {
    mockApi.listDirectory.mockResolvedValue([]);
    const result = await listBays(mockApi as never, 'proj-123');
    expect(result).toEqual([]);
  });

  it('reads each bay file', async () => {
    const bayId = '550e8400-e29b-41d4-a716-446655440001';
    mockApi.listDirectory.mockResolvedValue([`${bayId}.json`]);
    mockApi.readJson.mockResolvedValue({
      data: { id: bayId, voltage_level: 'J', bay_name: 'E00', display_id: '55E00', equipment_ids: [], signals: [] } as Bay,
      sha: 'sha1',
    });

    const result = await listBays(mockApi as never, 'proj-123');
    expect(result).toHaveLength(1);
    expect(result[0].display_id).toBe('55E00');
  });
});
```

- [ ] **Step 2: Keyra test — á að fallera við type errors**

Run: `npm test -- bayService`
Expected: FAIL — TS error um að `station` property missing/extra, eða test failure um `station in data`.

- [ ] **Step 3: Fjarlægja `station` úr Bay type**

Í `src/types.ts`, línur 172–182, skipta út:

```ts
export interface Bay {
  id: string;
  voltage_level: string;
  bay_name: string;
  display_id: string;
  equipment_ids: string[];
  signals: BaySignal[];
  status: BayStatus;
  review: BayReview | null;
}
```

- [ ] **Step 4: Fjarlægja `station` úr BayTemplate type**

Í `src/types.ts`, línur 242–250, skipta út:

```ts
export interface BayTemplate {
  template_name: string;
  voltage_level: string;
  bay_name: string;
  display_id: string;
  equipment_codes: string[];
  signals: Omit<BaySignal, 'phase_added'>[];
}
```

- [ ] **Step 5: Uppfæra `createBay` og `saveBayTemplate` í bayService**

Í `src/services/bayService.ts`, línur 18–47 (createBay), skipta út:

```ts
export async function createBay(
  api: GitHubApi,
  projectId: string,
  stationNumber: string,
  voltageLevel: string,
  bayName: string,
  signals: BaySignal[],
  _createdBy: string
): Promise<BayFile> {
  const id = uuid();
  const bay: Bay = {
    id,
    voltage_level: voltageLevel,
    bay_name: bayName,
    display_id: `${stationNumber}${bayName}`,
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
```

Og `saveBayTemplate` (línur 93–114), fjarlægja `station:` línuna (lína 100). Skipta út með:

```ts
export async function saveBayTemplate(
  api: GitHubApi,
  bay: Bay,
  templateName: string
): Promise<void> {
  const template: BayTemplate = {
    template_name: templateName,
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
```

- [ ] **Step 6: Keyra test**

Run: `npm test -- bayService`
Expected: PASS.

- [ ] **Step 7: Athugasemd — þriðja aðila staðir sem brotna**

Núna brotna callers sem lesa `bay.station` eða `BayTemplate.station`. Þeir eru:
- `src/pages/BayView.tsx:241` — fjallað í Task 5
- `src/pages/BayView.tsx:252` — fjallað í Task 5
- `src/pages/NewBay.tsx` — fjallað í Task 4

Við **committum ekki** fyrr en Task 4 og 5 eru búin því kóðinn byggir ekki á milli. Haltu áfram.

---

## Task 4: Uppfæra NewBay — fjarlægja station input, nota project.station_number

**Files:**
- Modify: `src/pages/NewBay.tsx:1-131`

- [ ] **Step 1: Skipta út öllu NewBay.tsx**

Skipta öllu innihaldi `src/pages/NewBay.tsx` út með:

```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { createBay, listBayTemplates } from '../services/bayService';
import { loadProject } from '../services/projectService';
import { Card, Button, Input, Select } from '../components/ui';
import type { BaySignal, BayTemplate } from '../types';

export function NewBay() {
  const { projectId } = useParams<{ projectId: string }>();
  const { api, userName } = useApi();
  const navigate = useNavigate();
  const [stationNumber, setStationNumber] = useState('');
  const [voltageLevel, setVoltageLevel] = useState('J');
  const [bayName, setBayName] = useState('');
  const [templates, setTemplates] = useState<BayTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load station_number from project + available bay templates
  useEffect(() => {
    if (!projectId) return;
    loadProject(api, projectId).then(files => {
      setStationNumber(files.project.station_number);
    }).catch(() => {});
    listBayTemplates(api).then(setTemplates).catch(() => {});
  }, [api, projectId]);

  const handleCreate = async () => {
    if (!stationNumber || !bayName.trim() || !projectId) return;
    setSaving(true);
    setError('');
    try {
      let signals: BaySignal[] = [];
      if (selectedTemplate) {
        const tmpl = templates.find(t => t.template_name === selectedTemplate);
        if (tmpl) {
          signals = tmpl.signals.map(s => ({
            ...s,
            phase_added: 'DESIGN' as const,
          }));
        }
      }
      const { bay } = await createBay(
        api, projectId, stationNumber, voltageLevel, bayName.trim().toUpperCase(), signals, userName
      );
      navigate(`/projects/${projectId}/bays/${bay.id}`);
    } catch {
      setError('Villa við að búa til reit. Reyndu aftur.');
      setSaving(false);
    }
  };

  const displayId = stationNumber && bayName ? `${stationNumber}${bayName.toUpperCase()}` : '';

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}`)}>
          ← Til baka
        </Button>
      </div>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 'var(--space-6)' }}>
        Nýr reitur
      </h1>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 'var(--space-3)' }}>
            <Input
              label="Spennutig"
              value={voltageLevel}
              onChange={setVoltageLevel}
              placeholder="J"
            />
            <Input
              label="Bay nafn"
              value={bayName}
              onChange={setBayName}
              placeholder="E00"
              required
            />
          </div>

          {displayId && (
            <div style={{
              background: 'var(--surface-alt)', borderRadius: 'var(--radius)',
              padding: 'var(--space-3)', fontSize: '13px', color: 'var(--text-secondary)',
            }}>
              Display ID: <strong style={{ color: 'var(--accent)' }}>{displayId}</strong>
            </div>
          )}

          <Select
            label="Sniðmát (valkvæmt)"
            value={selectedTemplate}
            onChange={setSelectedTemplate}
            options={[
              { value: '', label: '— Engin sniðmát —' },
              ...templates.map(t => ({ value: t.template_name, label: t.template_name })),
            ]}
          />

          {selectedTemplate && (
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {templates.find(t => t.template_name === selectedTemplate)?.signals.length ?? 0} merki verða flutt inn
            </div>
          )}

          {error && <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <Button variant="ghost" onClick={() => navigate(`/projects/${projectId}`)}>
              Hætta við
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !stationNumber || !bayName.trim()}
            >
              {saving ? 'Vista...' : 'Búa til reit'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
```

Breytingar frá núverandi:
- `station` state → `stationNumber` lesin úr `loadProject`
- Inga Stöðarnúmer input reit — grid er nú 2 dálkar (`80px 1fr`) í stað 3
- Áfram-takki lokaður þar til `stationNumber` er hlaðin

- [ ] **Step 2: Keyra type-check**

Run: `npx tsc --noEmit`
Expected: Engin villu í `NewBay.tsx`.

---

## Task 5: Uppfæra BayView — nota project.station_number í breadcrumb

**Files:**
- Modify: `src/pages/BayView.tsx:241` og `252` (+ nýr useEffect til að hlaða project)

- [ ] **Step 1: Lesa núverandi state-uppsetningu í BayView**

Run: `npm run dev` er ekki þörf — bara skoða skrána.
Finna staðina þar sem `bay.station` er notað (línur 241, 252).

- [ ] **Step 2: Bæta við project state og hlaða**

Efst í `BayView` component (þar sem önnur `useState` eru), bæta við:

```tsx
  const [stationNumber, setStationNumber] = useState<string>('');
```

Í `useEffect` sem keyrir við projectId/bayId breytingu, bæta við `loadProject` kalli eins og NewBay:

```tsx
  useEffect(() => {
    if (!projectId) return;
    loadProject(api, projectId).then(files => {
      setStationNumber(files.project.station_number);
    }).catch(() => {});
  }, [api, projectId]);
```

Bæta við import efst: `import { loadProject } from '../services/projectService';`

- [ ] **Step 3: Skipta út `bay.station` með `stationNumber`**

Í `src/pages/BayView.tsx`, lína 241, skipta út:

```tsx
          ← {stationNumber} verkefni
```

Lína 252 (display), skipta út:

```tsx
            {stationNumber} / {bay.voltage_level} / {bay.bay_name} — {bay.signals.length} merki
```

- [ ] **Step 4: Keyra type-check**

Run: `npx tsc --noEmit`
Expected: Engin villu.

- [ ] **Step 5: Keyra öll test**

Run: `npm test`
Expected: Öll test passa.

- [ ] **Step 6: Commit (Tasks 3+4+5 saman)**

```bash
git add src/types.ts src/services/bayService.ts src/services/bayService.test.ts src/pages/NewBay.tsx src/pages/BayView.tsx
git commit -m "Fjarlægja Bay.station og BayTemplate.station

Bay og BayTemplate fá ekki lengur station field. NewBay les
station_number úr project, BayView sömuleiðis fyrir breadcrumb.
display_id er áfram cached en reiknað úr project.station_number
þegar bay er stofnaður."
```

---

## Task 6: Ritstýring á project.station_number í ProjectView + cascade display_id

**Files:**
- Modify: `src/pages/ProjectView.tsx` (header svæði + ný handler)
- Modify: `src/services/bayService.ts` (nýtt helper `renameStation`)
- Test: `src/services/bayService.test.ts` (nýtt test)

- [ ] **Step 1: Skrifa failing test fyrir `renameStation`**

Í `src/services/bayService.test.ts`, bæta við í bottom:

```ts
describe('renameStation', () => {
  it('updates display_id on all bays for the project', async () => {
    const bayId = '550e8400-e29b-41d4-a716-446655440002';
    mockApi.listDirectory.mockResolvedValue([`${bayId}.json`]);
    mockApi.readJson.mockResolvedValue({
      data: { id: bayId, voltage_level: 'J', bay_name: 'E00', display_id: '55E00', equipment_ids: [], signals: [] } as Bay,
      sha: 'sha-old',
    });
    mockApi.writeJson.mockResolvedValue('sha-new');

    await renameStation(mockApi as never, 'proj-123', '66');

    expect(mockApi.writeJson).toHaveBeenCalledOnce();
    const [path, data] = mockApi.writeJson.mock.calls[0] as [string, Bay];
    expect(path).toBe(`projects/proj-123/bays/${bayId}.json`);
    expect(data.display_id).toBe('66E00');
  });

  it('does nothing when project has no bays', async () => {
    mockApi.listDirectory.mockResolvedValue([]);
    await renameStation(mockApi as never, 'proj-123', '66');
    expect(mockApi.writeJson).not.toHaveBeenCalled();
  });
});
```

Bæta við `renameStation` í import-inu efst:

```ts
import { createBay, listBays, loadBay, saveBay, renameStation } from './bayService';
```

- [ ] **Step 2: Keyra test — á að fallera (enginn renameStation)**

Run: `npm test -- bayService`
Expected: FAIL — „renameStation is not exported".

- [ ] **Step 3: Skrifa `renameStation` fall**

Í `src/services/bayService.ts`, bæta við neðst (eftir `rejectBay`):

```ts
export async function renameStation(
  api: GitHubApi,
  projectId: string,
  newStationNumber: string
): Promise<void> {
  let entries: string[];
  try {
    entries = await api.listDirectory(`projects/${projectId}/bays`);
  } catch {
    return;
  }
  const jsonFiles = entries.filter(e => e.endsWith('.json'));
  for (const file of jsonFiles) {
    const path = `projects/${projectId}/bays/${file}`;
    const { data: bay, sha } = await api.readJson<Bay>(path);
    const updated: Bay = {
      ...bay,
      display_id: `${newStationNumber}${bay.bay_name}`,
    };
    await api.writeJson(path, updated, sha, `Uppfæra display_id eftir stöðvar-númer breytingu`);
  }
}
```

Athugasemd: Sequential (ekki parallel) svo GitHub Contents API fær ekki 409 Conflict.

- [ ] **Step 4: Keyra test**

Run: `npm test -- bayService`
Expected: PASS.

- [ ] **Step 5: Bæta station_number input í ProjectView header**

Í `src/pages/ProjectView.tsx`, bæta við import (lína 8 svæði):

```tsx
import { listBays, loadBay, renameStation, sendBayForReview } from '../services/bayService';
```

Bæta við state fyrir savingStation (nálægt öðrum state hooks):

```tsx
  const [savingStation, setSavingStation] = useState(false);
```

Bæta við handler (nálægt öðrum handlers, eftir `saveEquipment`):

```tsx
  const handleStationChange = async (raw: string) => {
    if (!project || !projectId) return;
    const v = raw.replace(/\D/g, '').slice(0, 10);
    if (!v || v === project.station_number) return;
    setSavingStation(true);
    try {
      const updated: Project = { ...project, station_number: v };
      const newSha = await api.writeJson(
        `projects/${projectId}/project.json`, updated, projectSha,
        `Uppfæra stöðvar-númer: ${project.station_number} → ${v}`
      );
      setProject(updated);
      setProjectSha(newSha);
      await renameStation(api, projectId, v);
      // Reload bays so UI shows new display_id
      const bayList = await listBays(api, projectId);
      setBays(bayList);
    } catch {
      alert('Villa við að uppfæra stöðvar-númer.');
    } finally {
      setSavingStation(false);
    }
  };
```

Í header-inu (línur 278–286), skipta út með:

```tsx
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>{project.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '2px' }}>
            <label style={{ fontSize: '12px', color: 'var(--muted)' }}>Stöðvar númer:</label>
            <input
              type="text"
              inputMode="numeric"
              value={project.station_number}
              onChange={e => handleStationChange(e.target.value)}
              disabled={savingStation}
              style={{
                width: '80px', padding: '2px 6px', fontSize: '12px',
                background: 'var(--surface-alt)', border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              }}
            />
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              · {apparatus.length} búnaður · {ieds.length} IED · {bays.length} reitir
            </span>
          </div>
        </div>
        <Badge phase={project.phase}>{project.phase}</Badge>
      </div>
```

Athugasemd: `onChange` kallar strax á `handleStationChange` sem commitar í GitHub + cascade. Ekki debounce — notandi sér ekki UI fyrr en save er búið. Einfalt en nóg.

- [ ] **Step 6: Keyra build + tests**

Run: `npm run build`
Expected: Build passes, engin TS villu.

Run: `npm test`
Expected: Öll test passa.

- [ ] **Step 7: Commit**

```bash
git add src/services/bayService.ts src/services/bayService.test.ts src/pages/ProjectView.tsx
git commit -m "Ritstýring á stöðvar-númeri með cascade á bay display_id

ProjectView sýnir stöðvar-númer reit sem notandi getur breytt.
Breytingin vistast í project.json og uppfærir display_id á öllum
bays í verkefninu í gegn renameStation helper."
```

---

## Task 7: Verification og smoke test

- [ ] **Step 1: Full test keyrsla**

Run: `npm test`
Expected: 0 failures.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: Engin TS villu, build klárast.

- [ ] **Step 3: Grep til að tryggja engar leifar**

Run með Grep tóli (ekki bash): leita að `bay.station\b` og `BayTemplate.*station` í `src/`.
Expected: Engar niðurstöður (nema athugasemdir eða strengir sem nota „station" á íslensku).

- [ ] **Step 4: Manual smoke test í dev**

Run: `npm run dev`

Prófa:
1. Fara í http://localhost:5173/merkjalisti/, ekki sjá nein gömul verkefni (eyddur í merkjalisti-data áður)
2. Nýtt verkefni — tveir input reitir: nafn + stöðvar-númer
3. Setja nafn „Prófunarstöð" + númer „77"
4. Bæta við einu IED tæki í step 2 og klára
5. Á project síðu: sjá nafnið, stöðvar-númer 77 og badge
6. Búa til nýjan reit með nafn „E00" — sjá að Display ID sýnir „77E00" (enginn Stöðarnúmer input)
7. Fara til baka í project, breyta stöðvar-númeri í „88"
8. Endurhlaða (Ctrl+R) — sjá að bay display_id uppfærðist í „88E00"

Stöðva dev server með Ctrl+C.

- [ ] **Step 5: Engin uncommitted breyting**

Run: `git status`
Expected: „nothing to commit, working tree clean".

- [ ] **Step 6: Lokaskilaboð til notanda**

Tilkynna að verkefnið sé klárað. Ekki pusha á `origin/main` án samþykkis (per CLAUDE.md).
