# Plan 3 — Stöðvarmerki + Heildar listi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Klára tvo ólokna flipa í `ProjectView.tsx` — Stöðvarmerki (editable með full review workflow eins og bays) og Heildar listi (read-only aggregator með síum og Excel útflutningi).

**Architecture:** Ný `StationSignals` gerð speglar `Bay` struktúrinn (status + review + signals). Nýr `stationService.ts` speglar bay review functions. `StationSignalsTab.tsx` endurnotar `SignalTable`. `OverviewTab.tsx` flettir öllum bay signals + station signals í einn lista með síum og toggles. Auto-migration les gamalt array-snið í nýja wrapper-uppbyggingu.

**Tech Stack:** React 18 + TypeScript + Vite, Octokit GitHub API, vitest, `xlsx` fyrir Excel export, React Router v6.

**Spec:** `docs/superpowers/specs/2026-04-17-plan3-project-tabs-design.md`

---

## File Map

```
src/
  types.ts                           ← MODIFY — bæta StationSignals gerð + 'station' í TargetType
  services/
    projectService.ts                ← MODIFY — stationSignals: StationSignals + migration í loadProject
    projectService.test.ts           ← MODIFY — migration test
    stationService.ts                ← CREATE — loadStation, saveStation, sendForReview, approve, reject
    stationService.test.ts           ← CREATE — tests fyrir migration og review functions
  components/
    StationSignalsTab.tsx            ← CREATE — editable station signals með review workflow
    OverviewTab.tsx                  ← CREATE — aggregated read-only listi
  pages/
    ProjectView.tsx                  ← MODIFY — skipta placeholders út, bæta status-merki á flipa
```

---

## Task 1: Gagnalíkan — types.ts + projectService.ts migration

**Files:**
- Modify: `src/types.ts` — bæta `StationSignals` gerð + `'station'` í `target_type`
- Modify: `src/services/projectService.ts` — breyta `ProjectFiles.stationSignals` + migration í `loadProject` + nýtt snið í `createProject`
- Modify: `src/services/projectService.test.ts` — test fyrir migration

### Bakgrunnur

`ProjectFiles.stationSignals: BaySignal[]` breytist í `stationSignals: StationSignals`. `station_signals.json` vistar nú hlut `{ status, review, signals }`. Við `loadProject` lesum við `unknown` og migrate ef skráin er array (eldri útgáfa).

- [ ] **Skref 1: Lesa núverandi `types.ts` kafla fyrir `BayStatus`, `BayReview`, `ChangeEntry`**

```bash
cd /Users/teddi/Documents/merkjalisti && grep -n "BayStatus\|BayReview\|target_type" src/types.ts
```

Búast við: `BayStatus = 'DRAFT' | 'IN_REVIEW' | 'LOCKED'`, `BayReview` interface, og `target_type: 'signal' | 'bay' | 'project' | 'equipment'` á línu ~204.

- [ ] **Skref 2: Bæta við `StationSignals` gerð í `types.ts`**

Bæta á eftir `Bay` interface (í kring um línu 182), á undan "Changelog" section:

```typescript
// ─── Station signals ───────────────────────────────────────────────────────

export interface StationSignals {
  status: BayStatus;
  review: BayReview | null;
  signals: BaySignal[];
}
```

- [ ] **Skref 3: Bæta `'station'` við `target_type` í `ChangeEntry`**

Breyta í `types.ts`:

```typescript
// ÁÐUR:
target_type: 'signal' | 'bay' | 'project' | 'equipment';

// EFTIR:
target_type: 'signal' | 'bay' | 'project' | 'equipment' | 'station';
```

- [ ] **Skref 4: TypeScript check (búast við villum í projectService.ts)**

```bash
cd /Users/teddi/Documents/merkjalisti && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS"
```

Búast við: villur í `projectService.ts` því `stationSignals: BaySignal[]` passar ekki lengur við notkun í tests o.fl. — ekkert að gera í þessu skrefi, haldið áfram.

- [ ] **Skref 5: Skrifa migration test í `projectService.test.ts`**

Bæta við efst í `projectService.test.ts` (ef ekki til, búa til eftir mynstri `bayService.test.ts`):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadProject } from './projectService';
import type { BaySignal } from '../types';

const mockApi = {
  readJson: vi.fn(),
  writeJson: vi.fn(),
  listDirectory: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('loadProject — station_signals.json migration', () => {
  it('wraps legacy array shape into StationSignals object', async () => {
    const legacySignals: BaySignal[] = [];
    mockApi.readJson.mockImplementation((path: string) => {
      if (path.endsWith('station_signals.json')) return Promise.resolve({ data: legacySignals, sha: 'sha-stn' });
      if (path.endsWith('project.json')) return Promise.resolve({ data: { id: 'p1', name: 'X', description: '', created: '', phase: 'DESIGN', review: null }, sha: 'sha-p' });
      if (path.endsWith('equipment.json')) return Promise.resolve({ data: [], sha: 'sha-eq' });
      if (path.endsWith('changelog.json')) return Promise.resolve({ data: [], sha: 'sha-cl' });
      if (path.endsWith('testing.json')) return Promise.resolve({ data: { fat_started: null, fat_completed: null, sat_started: null, sat_completed: null, entries: [] }, sha: 'sha-t' });
      return Promise.reject(new Error('unexpected path: ' + path));
    });

    const result = await loadProject(mockApi as never, 'p1');
    expect(result.stationSignals).toEqual({ status: 'DRAFT', review: null, signals: [] });
    expect(result.stationSignalsSha).toBe('sha-stn');
  });

  it('passes through new StationSignals object shape unchanged', async () => {
    const newShape = { status: 'IN_REVIEW' as const, review: null, signals: [] };
    mockApi.readJson.mockImplementation((path: string) => {
      if (path.endsWith('station_signals.json')) return Promise.resolve({ data: newShape, sha: 'sha-stn' });
      if (path.endsWith('project.json')) return Promise.resolve({ data: { id: 'p1', name: 'X', description: '', created: '', phase: 'DESIGN', review: null }, sha: 'sha-p' });
      if (path.endsWith('equipment.json')) return Promise.resolve({ data: [], sha: 'sha-eq' });
      if (path.endsWith('changelog.json')) return Promise.resolve({ data: [], sha: 'sha-cl' });
      if (path.endsWith('testing.json')) return Promise.resolve({ data: { fat_started: null, fat_completed: null, sat_started: null, sat_completed: null, entries: [] }, sha: 'sha-t' });
      return Promise.reject(new Error('unexpected path: ' + path));
    });

    const result = await loadProject(mockApi as never, 'p1');
    expect(result.stationSignals).toEqual(newShape);
  });
});
```

- [ ] **Skref 6: Keyra test til að staðfesta að hann falli (RED)**

```bash
cd /Users/teddi/Documents/merkjalisti && npx vitest run src/services/projectService.test.ts
```

Búast við: TypeScript villa eða test fall því `ProjectFiles.stationSignals` er enn `BaySignal[]`.

- [ ] **Skref 7: Breyta `ProjectFiles.stationSignals` gerð í `projectService.ts`**

Í `src/services/projectService.ts` efst:

```typescript
// ÁÐUR:
import type {
  Project, Equipment, BaySignal, ChangeEntry, Testing, ProjectPhase
} from '../types';

// EFTIR:
import type {
  Project, Equipment, BaySignal, ChangeEntry, Testing, ProjectPhase, StationSignals
} from '../types';
```

Í `ProjectFiles`:

```typescript
// ÁÐUR:
stationSignals: BaySignal[];
stationSignalsSha: string;

// EFTIR:
stationSignals: StationSignals;
stationSignalsSha: string;
```

- [ ] **Skref 8: Uppfæra `createProject` — nýtt snið**

Í `createProject` falli, breyta línu 40:

```typescript
// ÁÐUR:
const stationSignals: BaySignal[] = [];

// EFTIR:
const stationSignals: StationSignals = { status: 'DRAFT', review: null, signals: [] };
```

`api.writeJson(... stationSignals, null, msg)` línan breytist ekki — hún vistar nú hlutinn í staðinn fyrir array.

Return-object breytist ekki heldur (bara gerð breytist).

- [ ] **Skref 9: Uppfæra `loadProject` — migration logic**

Í `loadProject` falli, breyta `api.readJson<BaySignal[]>` línunni:

```typescript
// ÁÐUR:
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

// EFTIR:
const [p, e, s, c, t] = await Promise.all([
  api.readJson<Project>(`${base}/project.json`),
  api.readJson<Equipment[]>(`${base}/equipment.json`),
  api.readJson<unknown>(`${base}/station_signals.json`),
  api.readJson<ChangeEntry[]>(`${base}/changelog.json`),
  api.readJson<Testing>(`${base}/testing.json`),
]);
const stationSignals: StationSignals = Array.isArray(s.data)
  ? { status: 'DRAFT', review: null, signals: s.data as BaySignal[] }
  : s.data as StationSignals;
return {
  project: p.data, projectSha: p.sha,
  equipment: e.data, equipmentSha: e.sha,
  stationSignals, stationSignalsSha: s.sha,
  changelog: c.data, changelogSha: c.sha,
  testing: t.data, testingSha: t.sha,
};
```

- [ ] **Skref 10: Keyra tests — bæði skulu passa**

```bash
cd /Users/teddi/Documents/merkjalisti && npx vitest run src/services/projectService.test.ts
```

Búast við: GREEN.

- [ ] **Skref 11: TypeScript check (allt verkefnið)**

```bash
cd /Users/teddi/Documents/merkjalisti && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "test\." | grep "error TS"
```

Búast við: engar villur. Ef villur koma í `ProjectView.tsx` eða öðrum stöðum sem lesa `stationSignals`, þá er það OK — lögum í seinni tasks. Aðrir staðir mega ekki brotna.

Ef villa kemur fyrir í `ProjectView.tsx`, athuga: notar `ProjectView` `stationSignals`? (Grep til að skoða.)

```bash
cd /Users/teddi/Documents/merkjalisti && grep -rn "stationSignals" src/ --include="*.ts" --include="*.tsx" | grep -v test
```

Bara `projectService.ts` á að vera að nota það núna — þangað til StationSignalsTab er skrifað í Task 3.

- [ ] **Skref 12: Commit**

```bash
cd /Users/teddi/Documents/merkjalisti
git add src/types.ts src/services/projectService.ts src/services/projectService.test.ts
git commit -m "feat: StationSignals gerð + auto-migration á station_signals.json

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: stationService.ts — review workflow

**Files:**
- Create: `src/services/stationService.ts`
- Create: `src/services/stationService.test.ts`

### Bakgrunnur

Parallel service við `bayService.ts` review functions. Munur: `path = projects/{projectId}/station_signals.json` (ekki bay-bundið), `target_type: 'station'`, `target_id: projectId`.

- [ ] **Skref 1: Skrifa failing test fyrir `loadStation`**

Búa til `src/services/stationService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadStation, sendStationForReview, approveStation, rejectStation } from './stationService';
import type { StationSignals } from '../types';

const mockApi = {
  readJson: vi.fn(),
  writeJson: vi.fn(),
  listDirectory: vi.fn(),
};

// Mock changelogService so we can assert appendChange calls
vi.mock('./changelogService', () => ({
  appendChange: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => vi.clearAllMocks());

describe('loadStation', () => {
  it('returns wrapped shape when file has StationSignals object', async () => {
    const station: StationSignals = { status: 'DRAFT', review: null, signals: [] };
    mockApi.readJson.mockResolvedValue({ data: station, sha: 'sha1' });
    const result = await loadStation(mockApi as never, 'p1');
    expect(result.station).toEqual(station);
    expect(result.sha).toBe('sha1');
  });

  it('migrates legacy array shape to StationSignals', async () => {
    mockApi.readJson.mockResolvedValue({ data: [], sha: 'sha1' });
    const result = await loadStation(mockApi as never, 'p1');
    expect(result.station).toEqual({ status: 'DRAFT', review: null, signals: [] });
  });
});

describe('sendStationForReview', () => {
  it('sets status=IN_REVIEW and creates review', async () => {
    const station: StationSignals = { status: 'DRAFT', review: null, signals: [] };
    mockApi.writeJson.mockResolvedValue('sha2');
    const result = await sendStationForReview(mockApi as never, 'p1', { station, sha: 'sha1' }, 'Teddi');
    expect(result.station.status).toBe('IN_REVIEW');
    expect(result.station.review?.sent_by).toBe('Teddi');
    expect(result.station.review?.status).toBe('OPEN');
    expect(mockApi.writeJson).toHaveBeenCalledWith(
      'projects/p1/station_signals.json',
      result.station,
      'sha1',
      expect.stringContaining('[REVIEW]')
    );
  });
});

describe('approveStation', () => {
  it('sets status=LOCKED with reviewed_by', async () => {
    const station: StationSignals = {
      status: 'IN_REVIEW',
      review: { sent_by: 'A', sent_at: '2026-04-17', reviewed_by: null, reviewed_at: null, status: 'OPEN', comment: null },
      signals: [],
    };
    mockApi.writeJson.mockResolvedValue('sha2');
    const result = await approveStation(mockApi as never, 'p1', { station, sha: 'sha1' }, 'Teddi', 'allt í lagi');
    expect(result.station.status).toBe('LOCKED');
    expect(result.station.review?.reviewed_by).toBe('Teddi');
    expect(result.station.review?.status).toBe('APPROVED');
    expect(result.station.review?.comment).toBe('allt í lagi');
  });
});

describe('rejectStation', () => {
  it('sets status=DRAFT with status=REJECTED in review', async () => {
    const station: StationSignals = {
      status: 'IN_REVIEW',
      review: { sent_by: 'A', sent_at: '2026-04-17', reviewed_by: null, reviewed_at: null, status: 'OPEN', comment: null },
      signals: [],
    };
    mockApi.writeJson.mockResolvedValue('sha2');
    const result = await rejectStation(mockApi as never, 'p1', { station, sha: 'sha1' }, 'Teddi', 'vantar merki');
    expect(result.station.status).toBe('DRAFT');
    expect(result.station.review?.status).toBe('REJECTED');
    expect(result.station.review?.comment).toBe('vantar merki');
  });
});
```

- [ ] **Skref 2: Keyra test — búast við RED (skrá ekki til)**

```bash
cd /Users/teddi/Documents/merkjalisti && npx vitest run src/services/stationService.test.ts
```

Búast við: failure — cannot resolve `./stationService`.

- [ ] **Skref 3: Búa til `src/services/stationService.ts`**

```typescript
// src/services/stationService.ts
import type { GitHubApi } from '../github/api';
import type { StationSignals, BaySignal, ProjectPhase } from '../types';
import { appendChange } from './changelogService';

export interface StationFile {
  station: StationSignals;
  sha: string;
}

function path(projectId: string): string {
  return `projects/${projectId}/station_signals.json`;
}

export async function loadStation(api: GitHubApi, projectId: string): Promise<StationFile> {
  const { data, sha } = await api.readJson<unknown>(path(projectId));
  const station: StationSignals = Array.isArray(data)
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
  const sha = await api.writeJson(path(projectId), file.station, file.sha, msg);
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
  const sha = await api.writeJson(path(projectId), updated, file.sha, msg);
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
  const sha = await api.writeJson(path(projectId), updated, file.sha, msg);
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
  const sha = await api.writeJson(path(projectId), updated, file.sha, msg);
  await appendChange(api, projectId, {
    user: reviewedBy, phase: 'REVIEW', type: 'REVIEW_REJECTED',
    target_id: projectId, target_type: 'station',
    field: null, old_value: 'IN_REVIEW', new_value: 'DRAFT',
    comment: `Stöðvarmerki hafnað. ${comment}`,
  });
  return { station: updated, sha };
}
```

- [ ] **Skref 4: Keyra test — búast við GREEN**

```bash
cd /Users/teddi/Documents/merkjalisti && npx vitest run src/services/stationService.test.ts
```

Búast við: allir 5 testar passi.

- [ ] **Skref 5: TypeScript check**

```bash
cd /Users/teddi/Documents/merkjalisti && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "test\." | grep "error TS"
```

Búast við: engar villur.

- [ ] **Skref 6: Commit**

```bash
cd /Users/teddi/Documents/merkjalisti
git add src/services/stationService.ts src/services/stationService.test.ts
git commit -m "feat: stationService — review workflow fyrir station_signals

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: StationSignalsTab component

**Files:**
- Create: `src/components/StationSignalsTab.tsx`

### Bakgrunnur

Speglar `BayView.tsx` hegðun en án bay-level state (equipment_ids, station/voltage/bay_name). Notar `SignalTable`, `SignalPickerModal`, `useAutoCommit`, review functions úr `stationService.ts`.

`SignalPickerModal` er í `src/components/SignalFormModal.tsx` (athuga skráarheiti — það er `SignalFormModal` ekki `SignalPickerModal` skrá, en exportar `SignalPickerModal`):

```bash
cd /Users/teddi/Documents/merkjalisti && grep -rn "export.*SignalPickerModal\|export.*SignalPickerModal" src/components/
```

Fara eftir mynstri þar.

- [ ] **Skref 1: Lesa núverandi `SignalPickerModal` props til að vita input**

```bash
cd /Users/teddi/Documents/merkjalisti && grep -n "interface Props\|^interface\|onAdd\|equipment:" src/components/SignalFormModal.tsx | head -10
```

Búast við að props séu: `phase: 'DESIGN' | ...`, `equipment: Equipment[]`, `onAdd: (signals: BaySignal[]) => void`, `onClose: () => void`.

- [ ] **Skref 2: Búa til `src/components/StationSignalsTab.tsx`**

```tsx
// src/components/StationSignalsTab.tsx
import { useEffect, useRef, useState } from 'react';
import { useApi } from '../context/ApiContext';
import {
  loadStation, saveStation, sendStationForReview, approveStation, rejectStation,
  type StationFile,
} from '../services/stationService';
import { useAutoCommit } from '../github/useAutoCommit';
import { Button } from './ui';
import { SignalTable } from './SignalTable';
import { SignalPickerModal } from './SignalFormModal';
import { appendChange } from '../services/changelogService';
import type { BaySignal, Equipment, SignalLibraryEntry, SignalState, ProjectPhase, StationSignals } from '../types';

interface Props {
  projectId: string;
  projectPhase: ProjectPhase;
  equipment: Equipment[];
}

export function StationSignalsTab({ projectId, projectPhase, equipment }: Props) {
  const { api, userName } = useApi();
  const [file, setFile] = useState<StationFile | null>(null);
  const [library, setLibrary] = useState<SignalLibraryEntry[]>([]);
  const [states, setStates] = useState<SignalState[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [reviewSending, setReviewSending] = useState(false);

  const fileRef = useRef<StationFile | null>(null);
  fileRef.current = file;

  useEffect(() => {
    Promise.all([
      loadStation(api, projectId),
      api.readJson<SignalLibraryEntry[]>('data/signal_library.json'),
      api.readJson<SignalState[]>('data/signal_states.json'),
    ]).then(([f, { data: lib }, { data: st }]) => {
      setFile(f);
      setLibrary(lib);
      setStates(st);
    }).finally(() => setLoading(false));
  }, [api, projectId]);

  const handleAdd = (signals: BaySignal[]) => {
    setFile(prev => {
      if (!prev) return prev;
      const next: StationSignals = { ...prev.station, signals: [...prev.station.signals, ...signals] };
      return { ...prev, station: next };
    });
    setIsDirty(true);
    setShowPicker(false);
    signals.forEach(sig => {
      appendChange(api, projectId, {
        user: userName, phase: 'DESIGN', type: 'SIGNAL_ADDED',
        target_id: sig.id, target_type: 'signal',
        field: null, old_value: null, new_value: `${sig.equipment_code}_${sig.signal_name}`,
        comment: `Stöðvarmerki bætt við: ${sig.signal_name}`,
      });
    });
  };

  const handleDelete = (signalId: string) => {
    const sig = fileRef.current?.station.signals.find(s => s.id === signalId);
    setFile(prev => {
      if (!prev) return prev;
      const next: StationSignals = { ...prev.station, signals: prev.station.signals.filter(s => s.id !== signalId) };
      return { ...prev, station: next };
    });
    setIsDirty(true);
    if (sig) {
      appendChange(api, projectId, {
        user: userName, phase: 'DESIGN', type: 'SIGNAL_REMOVED',
        target_id: signalId, target_type: 'signal',
        field: null, old_value: `${sig.equipment_code}_${sig.signal_name}`, new_value: null,
        comment: `Stöðvarmerki eytt: ${sig.signal_name}`,
      });
    }
  };

  const handleUpdate = (signalId: string, patch: Partial<BaySignal>) => {
    setFile(prev => {
      if (!prev) return prev;
      const next: StationSignals = {
        ...prev.station,
        signals: prev.station.signals.map(s => s.id === signalId ? { ...s, ...patch } : s),
      };
      return { ...prev, station: next };
    });
    setIsDirty(true);
  };

  const commitChanges = async () => {
    const current = fileRef.current;
    if (!current) return;

    let toSave = current;
    if (current.station.status === 'LOCKED') {
      const cleared: StationSignals = {
        ...current.station,
        status: 'DRAFT',
        signals: current.station.signals.map(s => ({ ...s, review_flagged: false, review_comment: null })),
      };
      toSave = { ...current, station: cleared };
    }

    const updated = await saveStation(api, projectId, toSave, projectPhase);
    setFile(updated);
    setIsDirty(false);
    setLastSaved(new Date());

    if (current.station.status === 'LOCKED') {
      await appendChange(api, projectId, {
        user: userName, phase: 'DESIGN', type: 'PHASE_CHANGED',
        target_id: projectId, target_type: 'station',
        field: null, old_value: 'LOCKED', new_value: 'DRAFT',
        comment: 'Stöðvarmerki opnuð aftur eftir læsingu',
      });
    }
  };

  useAutoCommit(isDirty, commitChanges);

  const handleSendForReview = async () => {
    const current = fileRef.current;
    if (!current) return;
    if (!confirm('Senda stöðvarmerki í yfirferð? Þau verða læst þar til yfirferð lýkur.')) return;
    setReviewSending(true);
    try {
      const updated = await sendStationForReview(api, projectId, current, userName);
      setFile(updated);
      setIsDirty(false);
    } catch {
      alert('Villa við að senda í yfirferð. Reyndu aftur.');
    } finally {
      setReviewSending(false);
    }
  };

  const handleApprove = async () => {
    const current = fileRef.current;
    if (!current) return;
    setReviewSending(true);
    try {
      const raw = prompt('Athugasemd (valkvæmt):');
      if (raw === null) return;
      const comment = raw.trim() || null;
      const updated = await approveStation(api, projectId, current, userName, comment);
      setFile(updated);
    } catch {
      alert('Villa við samþykki. Reyndu aftur.');
    } finally {
      setReviewSending(false);
    }
  };

  const handleReject = async () => {
    const current = fileRef.current;
    if (!current) return;
    setReviewSending(true);
    try {
      const comment = prompt('Ástæða hafnunar (nauðsynlegt):');
      if (!comment?.trim()) return;
      const updated = await rejectStation(api, projectId, current, userName, comment.trim());
      setFile(updated);
    } catch {
      alert('Villa við höfnun. Reyndu aftur.');
    } finally {
      setReviewSending(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;
  if (!file) return <p style={{ color: 'var(--danger)' }}>Stöðvarmerki finnast ekki.</p>;

  const { station } = file;
  const isInReview = station.status === 'IN_REVIEW';
  const isLocked = station.status === 'LOCKED';
  const isDraftStatus = station.status === 'DRAFT';

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)',
      }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {station.signals.length} stöðvarmerki
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!isDraftStatus && (
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              background: isInReview ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'color-mix(in srgb, var(--success) 20%, transparent)',
              color: isInReview ? 'var(--accent)' : 'var(--success)',
              border: `1px solid ${isInReview ? 'var(--accent)' : 'var(--success)'}`,
            }}>
              {isInReview
                ? `Í YFIRFERÐ — sent af ${station.review?.sent_by ?? ''} ${station.review?.sent_at ? new Date(station.review.sent_at).toLocaleDateString('is-IS') : ''}`
                : `LÆST — samþykkt af ${station.review?.reviewed_by ?? ''} ${station.review?.reviewed_at ? new Date(station.review.reviewed_at).toLocaleDateString('is-IS') : ''}`
              }
            </span>
          )}
          {isDirty && <span style={{ fontSize: '12px', color: 'var(--warn)' }}>● Óvistað</span>}
          {lastSaved && !isDirty && (
            <span style={{ fontSize: '12px', color: 'var(--success)' }}>
              ✓ Vistað {lastSaved.toLocaleTimeString('is-IS')}
            </span>
          )}

          {isDraftStatus && (
            <>
              <Button size="sm" onClick={() => setShowPicker(true)} disabled={projectPhase !== 'DESIGN'}>+ Bæta við merki</Button>
              <Button size="sm" onClick={commitChanges} disabled={!isDirty}>Vista núna</Button>
              <Button size="sm" variant="ghost" onClick={handleSendForReview} disabled={reviewSending || station.signals.length === 0}>→ Senda í yfirferð</Button>
            </>
          )}

          {isInReview && (
            <>
              <Button size="sm" variant="ghost" onClick={handleReject} disabled={reviewSending} style={{ color: 'var(--danger)' }}>✕ Hafna</Button>
              <Button size="sm" onClick={handleApprove} disabled={reviewSending}>✓ Samþykkja</Button>
            </>
          )}

          {isLocked && (
            <>
              <Button size="sm" onClick={() => setShowPicker(true)} disabled={projectPhase !== 'DESIGN'}>+ Bæta við merki</Button>
              <Button size="sm" onClick={commitChanges} disabled={!isDirty}>Vista núna</Button>
            </>
          )}
        </div>
      </div>

      <SignalTable
        signals={station.signals}
        equipment={equipment}
        library={library}
        states={states}
        bayDisplayId="STÖÐ"
        reviewMode={isInReview || station.signals.some(s => s.review_flagged)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {showPicker && (
        <SignalPickerModal
          phase="DESIGN"
          equipment={equipment}
          onAdd={handleAdd}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Skref 3: TypeScript check**

```bash
cd /Users/teddi/Documents/merkjalisti && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "test\." | grep "error TS"
```

Búast við: engar villur. Ef villa kemur um `SignalPickerModal` props, samstilla eftir núverandi notkun í `BayView.tsx` línu 379-385.

- [ ] **Skref 4: Commit**

```bash
cd /Users/teddi/Documents/merkjalisti
git add src/components/StationSignalsTab.tsx
git commit -m "feat: StationSignalsTab component með review workflow

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: OverviewTab component með síum og Excel export

**Files:**
- Create: `src/components/OverviewTab.tsx`

### Bakgrunnur

Aggregate read-only view. Lær `listBays` + `loadBay` fyrir alla reiti, `loadStation` fyrir stöðvarmerki. Flætir í `Row[]` struktúr og sýnir í töflu með síum.

- [ ] **Skref 1: Búa til `src/components/OverviewTab.tsx`**

```tsx
// src/components/OverviewTab.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { listBays, loadBay } from '../services/bayService';
import { loadStation } from '../services/stationService';
import { exportAllBaysToExcel } from '../services/exportService';
import { Button } from './ui';
import type { Bay, BaySignal, ProjectPhase } from '../types';

interface Props {
  projectId: string;
  projectName: string;
}

type Source =
  | { kind: 'bay'; bayId: string; displayId: string; bayName: string }
  | { kind: 'station' };

interface Row {
  source: Source;
  signal: BaySignal;
}

type PhaseFilter = 'ALL' | ProjectPhase;
type SourceFilter = 'ALL' | 'IED' | 'HARDWIRED';

export function OverviewTab({ projectId, projectName }: Props) {
  const { api } = useApi();
  const navigate = useNavigate();

  const [bays, setBays] = useState<Bay[]>([]);
  const [stationSignals, setStationSignals] = useState<BaySignal[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedBays, setSelectedBays] = useState<Set<string>>(new Set()); // empty = all
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('ALL');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');
  const [alarmOnly, setAlarmOnly] = useState(false);
  const [untestedOnly, setUntestedOnly] = useState(false);

  useEffect(() => {
    Promise.all([
      listBays(api, projectId).then(async (baysMeta) => {
        const full = await Promise.all(baysMeta.map(b => loadBay(api, projectId, b.id).then(f => f.bay)));
        return full;
      }),
      loadStation(api, projectId),
    ]).then(([fullBays, stationFile]) => {
      setBays(fullBays);
      setStationSignals(stationFile.station.signals);
    }).finally(() => setLoading(false));
  }, [api, projectId]);

  const rows: Row[] = useMemo(() => {
    const bayRows: Row[] = bays.flatMap(bay =>
      bay.signals.map(signal => ({
        source: { kind: 'bay' as const, bayId: bay.id, displayId: bay.display_id, bayName: bay.bay_name },
        signal,
      }))
    );
    const stationRows: Row[] = stationSignals.map(signal => ({
      source: { kind: 'station' as const },
      signal,
    }));
    return [...bayRows, ...stationRows];
  }, [bays, stationSignals]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter(r => {
      // Search
      if (q) {
        const hay = [
          r.signal.signal_name, r.signal.name_is, r.signal.name_en ?? '',
          r.signal.iec61850_ld ?? '', r.signal.iec61850_ln ?? '', r.signal.iec61850_do_da ?? '',
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // Bay multiselect
      if (selectedBays.size > 0) {
        const key = r.source.kind === 'bay' ? r.source.bayId : 'station';
        if (!selectedBays.has(key)) return false;
      }
      // Phase
      if (phaseFilter !== 'ALL' && r.signal.phase_added !== phaseFilter) return false;
      // Source type
      if (sourceFilter !== 'ALL' && r.signal.source_type !== sourceFilter) return false;
      // Alarm only
      if (alarmOnly && !r.signal.is_alarm) return false;
      // Untested only
      if (untestedOnly && r.signal.fat_tested && r.signal.sat_tested) return false;
      return true;
    });
  }, [rows, search, selectedBays, phaseFilter, sourceFilter, alarmOnly, untestedOnly]);

  const iecAddress = (sig: BaySignal): string => {
    const parts = [sig.iec61850_ld, sig.iec61850_ln, sig.iec61850_do_da].filter(Boolean);
    return parts.length > 0 ? parts.join('/') : '—';
  };

  const handleExport = () => {
    const syntheticStationBay: Bay = {
      id: 'station',
      station: projectName,
      voltage_level: '',
      bay_name: 'Stöðvarmerki',
      display_id: 'STÖÐ',
      equipment_ids: [],
      signals: stationSignals,
      status: 'DRAFT',
      review: null,
    };
    exportAllBaysToExcel([...bays, syntheticStationBay], projectName);
  };

  const toggleBayFilter = (key: string) => {
    setSelectedBays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;

  const cell: React.CSSProperties = {
    padding: '5px 8px', borderBottom: '1px solid var(--line-muted)',
    fontSize: '12px', verticalAlign: 'middle',
  };
  const head: React.CSSProperties = {
    ...cell, fontWeight: 600, color: 'var(--text-secondary)',
    background: 'var(--surface-alt)', whiteSpace: 'nowrap',
    position: 'sticky', top: 0, zIndex: 1,
  };
  const selectStyle: React.CSSProperties = {
    background: 'var(--surface-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '5px 8px', fontSize: '12px', outline: 'none',
  };
  const bayKeys: { key: string; label: string }[] = [
    ...bays.map(b => ({ key: b.id, label: b.display_id })),
    { key: 'station', label: 'Stöð' },
  ];

  return (
    <div>
      {/* Filter row 1 */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Leit — kóði, nafn, IEC address..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...selectStyle, minWidth: '240px', flex: '1 1 240px' }}
        />
        <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value as PhaseFilter)} style={selectStyle}>
          <option value="ALL">Allir fasar</option>
          <option value="DESIGN">DESIGN</option>
          <option value="FROZEN">FROZEN</option>
          <option value="REVIEW">REVIEW</option>
          <option value="FAT">FAT</option>
          <option value="SAT">SAT</option>
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as SourceFilter)} style={selectStyle}>
          <option value="ALL">Allir uppruni</option>
          <option value="IED">IED</option>
          <option value="HARDWIRED">HARDWIRED</option>
        </select>
      </div>

      {/* Bay multiselect chips */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: 'var(--muted)', alignSelf: 'center' }}>Reit:</span>
        {bayKeys.map(b => {
          const active = selectedBays.size === 0 || selectedBays.has(b.key);
          return (
            <button key={b.key} type="button" onClick={() => toggleBayFilter(b.key)}
              style={{
                padding: '2px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                background: active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface-alt)',
                color: active ? 'var(--accent)' : 'var(--muted)',
                cursor: 'pointer', fontFamily: 'monospace',
              }}>
              {b.label}
            </button>
          );
        })}
        {selectedBays.size > 0 && (
          <button type="button" onClick={() => setSelectedBays(new Set())}
            style={{ padding: '2px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--line)', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
            Hreinsa
          </button>
        )}
      </div>

      {/* Filter row 2 — toggles + count + export */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={alarmOnly} onChange={e => setAlarmOnly(e.target.checked)} />
          Bara alarm
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={untestedOnly} onChange={e => setUntestedOnly(e.target.checked)} />
          Bara óprófað
        </label>
        <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: 'auto' }}>
          Sýnd {filtered.length} af {rows.length} merkjum
        </span>
        <Button size="sm" variant="ghost" onClick={handleExport} disabled={rows.length === 0}>↓ Excel</Button>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'auto', maxHeight: '70vh' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Reit', 'Tæki', 'Kóði', 'Nafn IS', 'Nafn EN', 'Alarm', 'Klass', 'Uppruni', 'IEC 61850', 'Fasi', 'FAT', 'SAT'].map(h => (
                <th key={h} style={head}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={12} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-8)' }}>Engin merki</td></tr>
            )}
            {filtered.map((r, i) => {
              const sig = r.signal;
              const fatColor = sig.fat_result === 'PASS' ? 'var(--success)' : sig.fat_result === 'FAIL' ? 'var(--danger)' : 'var(--text)';
              const satColor = sig.sat_result === 'PASS' ? 'var(--success)' : sig.sat_result === 'FAIL' ? 'var(--danger)' : 'var(--text)';
              return (
                <tr key={`${sig.id}-${i}`} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                  <td style={{ ...cell, fontFamily: 'monospace', fontWeight: 600 }}>
                    {r.source.kind === 'bay' ? (
                      <button type="button"
                        onClick={() => navigate(`/projects/${projectId}/bays/${r.source.kind === 'bay' ? r.source.bayId : ''}`)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, font: 'inherit' }}>
                        {r.source.displayId}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>Stöð</span>
                    )}
                  </td>
                  <td style={{ ...cell, fontFamily: 'monospace' }}>{sig.equipment_code}</td>
                  <td style={{ ...cell, fontFamily: 'monospace' }}>{sig.signal_name}</td>
                  <td style={cell}>{sig.name_is}</td>
                  <td style={{ ...cell, color: 'var(--muted)' }}>{sig.name_en ?? '—'}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>{sig.is_alarm ? '✓' : '—'}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>{sig.alarm_class ?? '—'}</td>
                  <td style={{ ...cell, fontSize: '11px' }}>{sig.source_type}</td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>{iecAddress(sig)}</td>
                  <td style={{ ...cell, fontSize: '11px' }}>{sig.phase_added}</td>
                  <td style={{ ...cell, textAlign: 'center', color: fatColor }}>{sig.fat_tested ? '✓' : '—'}</td>
                  <td style={{ ...cell, textAlign: 'center', color: satColor }}>{sig.sat_tested ? '✓' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Skref 2: TypeScript check**

```bash
cd /Users/teddi/Documents/merkjalisti && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "test\." | grep "error TS"
```

Búast við: engar villur.

- [ ] **Skref 3: Commit**

```bash
cd /Users/teddi/Documents/merkjalisti
git add src/components/OverviewTab.tsx
git commit -m "feat: OverviewTab — aggregated signal listi með síum og Excel export

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: ProjectView wiring — skipta placeholders út

**Files:**
- Modify: `src/pages/ProjectView.tsx`

### Bakgrunnur

Skipta út placeholder Card-unum í línum ~558-567 með nýju components. Bæta einnig við status-merki við hliðina á "Stöðvarmerki" label í TABS.

- [ ] **Skref 1: Staðfesta núverandi placeholders**

```bash
cd /Users/teddi/Documents/merkjalisti && grep -n "kemur í Plan 3" src/pages/ProjectView.tsx
```

Búast við: línur í kringum 560 og 565.

- [ ] **Skref 2: Bæta import-línum efst í `ProjectView.tsx`**

Núverandi import (um línu 1-12):

```typescript
// ... existing imports ...
import { loadProject, saveProjectPhase } from '../services/projectService';
// ... etc ...
```

Bæta við:

```typescript
import { StationSignalsTab } from '../components/StationSignalsTab';
import { OverviewTab } from '../components/OverviewTab';
import { loadStation } from '../services/stationService';
import type { BayStatus } from '../types';
```

- [ ] **Skref 3: Bæta við state fyrir station status (fyrir tab badge)**

Í `ProjectView` component body (þar sem önnur `useState` kall eru, um línu 85-95):

```typescript
const [stationStatus, setStationStatus] = useState<BayStatus | null>(null);
```

Og í `useEffect` (þar sem loaded er project og bays, um línu 109-120), bæta við í `Promise.all`:

Finna þennan kóða-kafla:
```typescript
useEffect(() => {
  if (!projectId) return;
  Promise.all([
    // ... existing fetches
  ]).then(...);
```

Bæta við `loadStation(api, projectId).then(f => f.station.status).catch(() => null)` í Promise.all og destructure í niðurstöðu. Ef existing code ekki skýr, þá gera sér `useEffect` fyrir station status:

```typescript
useEffect(() => {
  if (!projectId) return;
  loadStation(api, projectId)
    .then(f => setStationStatus(f.station.status))
    .catch(() => setStationStatus(null));
}, [api, projectId]);
```

- [ ] **Skref 4: Skipta út placeholders**

Finna línur um 558-567 (`{tab === 'station' && ...}` og `{tab === 'overview' && ...}`):

```typescript
// ÁÐUR:
{tab === 'station' && (
  <Card style={{ color: 'var(--muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
    Stöðvarmerki — kemur í Plan 3
  </Card>
)}
{tab === 'overview' && (
  <Card style={{ color: 'var(--muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
    Heildar listi — kemur í Plan 3
  </Card>
)}

// EFTIR:
{tab === 'station' && projectId && project && (
  <StationSignalsTab
    projectId={projectId}
    projectPhase={project.phase}
    equipment={equipment}
  />
)}
{tab === 'overview' && projectId && project && (
  <OverviewTab projectId={projectId} projectName={project.name} />
)}
```

- [ ] **Skref 5: Bæta við status-dot við hliðina á "Stöðvarmerki" tab label**

Finna `TABS` array um línu 225-231:

```typescript
// ÁÐUR:
const TABS: { id: Tab; label: string }[] = [
  { id: 'bays', label: `Reitir (${bays.length})` },
  { id: 'equipment', label: `Tæki (${equipment.length})` },
  { id: 'station', label: 'Stöðvarmerki' },
  { id: 'overview', label: 'Heildar listi' },
  { id: 'changelog', label: 'Breytingasaga' },
];

// EFTIR:
const stationIndicator = stationStatus === 'IN_REVIEW' ? ' •' : stationStatus === 'LOCKED' ? ' ✓' : '';
const TABS: { id: Tab; label: string }[] = [
  { id: 'bays', label: `Reitir (${bays.length})` },
  { id: 'equipment', label: `Tæki (${equipment.length})` },
  { id: 'station', label: `Stöðvarmerki${stationIndicator}` },
  { id: 'overview', label: 'Heildar listi' },
  { id: 'changelog', label: 'Breytingasaga' },
];
```

- [ ] **Skref 6: TypeScript check**

```bash
cd /Users/teddi/Documents/merkjalisti && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "test\." | grep "error TS"
```

Búast við: engar villur.

- [ ] **Skref 7: Keyra öll test til að ganga úr skugga um ekkert brotnaði**

```bash
cd /Users/teddi/Documents/merkjalisti && npx vitest run
```

Búast við: öll test passa.

- [ ] **Skref 8: Commit**

```bash
cd /Users/teddi/Documents/merkjalisti
git add src/pages/ProjectView.tsx
git commit -m "feat: ProjectView — tengja StationSignalsTab + OverviewTab, tab status indicator

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Manual smoke test + lokafrágangur

**Files:** (engar breytingar — bara staðfesting)

### Bakgrunnur

Keyra `npm run dev` og ganga úr skugga um að allt virki í vafra. TypeScript og vitest eru ekki nóg — UI-hegðun þarf að staðfesta.

- [ ] **Skref 1: Keyra `npm run build` til að staðfesta full build virkar**

```bash
cd /Users/teddi/Documents/merkjalisti && npm run build
```

Búast við: build tekst án villu.

- [ ] **Skref 2: Keyra dev server**

```bash
cd /Users/teddi/Documents/merkjalisti && npm run dev
```

Dev server á `http://localhost:5173/merkjalisti/`.

- [ ] **Skref 3: Smoke test checklist (handvirkt í vafra)**

Opna verkefni í vafra og prófa:

- [ ] Opna "Stöðvarmerki" flipa → sést "Hleður..." og svo tóm tafla (eða núverandi merki)
- [ ] Smella "+ Bæta við merki" → picker modal opnast
- [ ] Bæta við 1–2 merkjum → þau birtast í töflu
- [ ] Breyta reit á einu merki → "● Óvistað" birtist
- [ ] Smella "Vista núna" → "✓ Vistað HH:MM:SS"
- [ ] Smella "→ Senda í yfirferð" → confirm dialog → status verður "Í YFIRFERÐ"
- [ ] SignalTable er í reviewMode (flag dálkur sýnilegur)
- [ ] Smella "✓ Samþykkja" → comment prompt → status verður "LÆST"
- [ ] Smella "Breytingasaga" flipa → sjá REVIEW_ADDED + REVIEW_APPROVED entries fyrir `target_type: station`
- [ ] Opna "Heildar listi" flipa → sést listi með öllum merkjum úr öllum reitum + stöð
- [ ] Smella á bay-nafn í "Reit" dálki → nav fer í reit
- [ ] Slá inn í leitarreit → listi síast
- [ ] Velja bay chip → bara sá bay sést
- [ ] "Bara alarm" toggle → bara alarm merki sjást
- [ ] Smella "↓ Excel" → Excel skjal hleðst niður, inniheldur `STÖÐ` reit

- [ ] **Skref 4: Ef allt virkar — lokasumma**

Tilkynna notanda: "Plan 3 klárað. 5 commits á main. Push ef vilt."

- [ ] **Skref 5: Ef villur koma — flokka þær**

Ef villa kemur í einhverjum skrefum að ofan, stoppa og segja notanda hvaða skref féll og með hvaða villu. Ekki gera við nema að ráði notanda.

---

## Sjálfsyfirferð

**1. Spec coverage (athugað gegn `2026-04-17-plan3-project-tabs-design.md`):**
- ✅ `StationSignals` gerð + migration — Task 1
- ✅ `'station'` í `target_type` — Task 1
- ✅ `stationService.ts` með load/save/review functions — Task 2
- ✅ `StationSignalsTab` með full review workflow — Task 3
- ✅ Phase-lock á StationSignalsTab — Task 3 (disabled prop á "+ Bæta við merki")
- ✅ `OverviewTab` með síum (leit, reit multiselect, fasi, uppruni) — Task 4
- ✅ Toggles "Bara alarm" + "Bara óprófað" — Task 4
- ✅ Excel export með synthetic STÖÐ bay — Task 4
- ✅ ProjectView wiring — Task 5
- ✅ Tab status indicator — Task 5
- ✅ Manual smoke test — Task 6

**2. Placeholder scan:** Engar. Allt konkret — skráarnöfn, bash commands, kóðablokkir.

**3. Type consistency:**
- `StationSignals` definition notuð í `types.ts`, `projectService.ts`, `stationService.ts`, `StationSignalsTab.tsx` — passar alls staðar
- `StationFile = { station: StationSignals; sha: string }` — consistent í `stationService.ts` og `StationSignalsTab.tsx`
- `loadStation(api, projectId): Promise<StationFile>` — sama signature í test, service, component

**4. Ambiguity:**
- `stationIndicator` í Task 5 skref 5 — explicit mappping: `IN_REVIEW` → ' •', `LOCKED` → ' ✓', annars ''.
- `untestedOnly` filter í Task 4 — explicit: `!fat_tested || !sat_tested` (ANY untested)
- Bay filter "engin valin = allt" — explicit í toggleBayFilter og filter logic

Ekkert að laga.
