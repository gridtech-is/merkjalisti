# Breytanlegur heildar-listi (Editable OverviewTab) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OverviewTab fully editable — all signal fields editable inline, auto-save per changed bay (30s debounce), FAT/SAT columns, same SignalTable layout as BayView.

**Architecture:** Load `BayFile[]` (with SHA) instead of `Bay[]` so each bay can be saved independently. Track which bays have unsaved changes via a `dirtyBayIds` ref. One `useAutoCommit` hook saves all dirty bays on the 30s debounce or on unmount. Replace the custom read-only table with per-bay `SignalTable` sections. Add `showFatSat` and `hideToolbar` props to `SignalTable` to support inline FAT/SAT editing and external filter control.

**Tech Stack:** React 18 + TypeScript, existing `SignalTable`, `bayService`, `useAutoCommit`, `saveBay`, `useLibrary`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/services/bayService.ts` | Modify | Add `listBayFiles` returning `BayFile[]` with SHA |
| `src/services/bayService.test.ts` | Modify | Test for `listBayFiles` |
| `src/components/SignalTable.tsx` | Modify | `onDelete` optional, `hideToolbar` prop, `showFatSat` prop |
| `src/components/OverviewTab.tsx` | Rewrite | Per-bay editable sections, dirty tracking, auto-save |
| `src/pages/ProjectView.tsx` | Modify | Pass `projectPhase` prop to `OverviewTab` |

---

## Task 1: `listBayFiles` in bayService

**Files:**
- Modify: `src/services/bayService.ts`
- Modify: `src/services/bayService.test.ts`

- [ ] **Step 1: Write failing test**

Add to `src/services/bayService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBay, listBays, listBayFiles, renameStation } from './bayService';
```

```ts
describe('listBayFiles', () => {
  it('returns BayFile[] with sha for each non-deleted bay', async () => {
    const bayId = '550e8400-e29b-41d4-a716-446655440002';
    mockApi.listDirectory.mockResolvedValue([`${bayId}.json`]);
    mockApi.readJson.mockResolvedValue({
      data: {
        id: bayId, voltage_level: 'J', bay_name: 'E00',
        display_id: '55E00', description: null, equipment_ids: [],
        signals: [], status: 'DRAFT', review: null,
      } as Bay,
      sha: 'sha-abc',
    });

    const result = await listBayFiles(mockApi as never, 'proj-123');
    expect(result).toHaveLength(1);
    expect(result[0].bay.display_id).toBe('55E00');
    expect(result[0].sha).toBe('sha-abc');
  });

  it('excludes DELETED bays', async () => {
    const bayId = '550e8400-e29b-41d4-a716-446655440003';
    mockApi.listDirectory.mockResolvedValue([`${bayId}.json`]);
    mockApi.readJson.mockResolvedValue({
      data: {
        id: bayId, voltage_level: 'J', bay_name: 'E99',
        display_id: '55E99', description: null, equipment_ids: [],
        signals: [], status: 'DELETED', review: null,
      } as Bay,
      sha: 'sha-del',
    });

    const result = await listBayFiles(mockApi as never, 'proj-123');
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- bayService
```
Expected: FAIL — `listBayFiles` not exported

- [ ] **Step 3: Implement `listBayFiles` in bayService.ts**

Add after `listBays` function (around line 76):

```ts
export async function listBayFiles(api: GitHubApi, projectId: string): Promise<BayFile[]> {
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
      const bay: Bay = {
        ...data,
        status: data.status ?? ('DRAFT' as const),
        review: data.review ?? null,
        signals: data.signals.map(s => ({
          ...s,
          review_flagged: s.review_flagged ?? false,
          review_comment: s.review_comment ?? null,
        })),
      };
      return { bay, sha: r.value.sha };
    })
    .filter(f => f.bay.status !== 'DELETED');
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- bayService
```
Expected: PASS (all bayService tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/bayService.ts src/services/bayService.test.ts
git commit -m "feat: bæta við listBayFiles sem skilar BayFile[] með SHA"
```

---

## Task 2: SignalTable — `onDelete` optional + `hideToolbar` + `showFatSat`

**Files:**
- Modify: `src/components/SignalTable.tsx`

These three changes are batched in one task since they're all small prop additions.

### 2a — `onDelete` optional

- [ ] **Step 1: Make `onDelete` optional in Props interface**

In `src/components/SignalTable.tsx`, find the Props interface (around line 70–86). Change:

```ts
  onDelete: (signalId: string) => void;
```
to:
```ts
  onDelete?: (signalId: string) => void;
```

- [ ] **Step 2: Guard the delete button and column header**

Find the delete `<Button>` cell in the tbody (around line 1128–1130):

```tsx
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    <Button variant="danger" size="sm" onClick={() => onDelete(sig.id)}>Eyða</Button>
                  </td>
```

Replace with:

```tsx
                  {onDelete && (
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                      <Button variant="danger" size="sm" onClick={() => onDelete(sig.id)}>Eyða</Button>
                    </td>
                  )}
```

Find the two empty delete column `<th>` elements in thead (lines 580 and 599):

Row 1 (around line 580):
```tsx
              <th style={head}></th>
```
Wrap it:
```tsx
              {onDelete !== undefined && <th style={head}></th>}
```

Row 2 sub-header (around line 599):
```tsx
              <th style={{ ...head, top: '33px' }}></th>
```
Wrap it:
```tsx
              {onDelete !== undefined && <th style={{ ...head, top: '33px' }}></th>}
```

Also update the destructuring on line 146 to include `onDelete` as optional (TypeScript already handles this — no change needed to destructuring since it was already there).

### 2b — `hideToolbar` prop

- [ ] **Step 3: Add `hideToolbar` to Props and wrap the filter bar**

In Props interface (around line 70), add:
```ts
  hideToolbar?: boolean;
```

In the function signature destructuring (line 146), add `hideToolbar = false` to the destructured params.

Find the filter div (around line 342–558, starts with `{/* Filter */}`). Wrap the entire filter `<div>` with:

```tsx
      {!hideToolbar && (
        <div style={{ marginBottom: 'var(--space-3)', ...}}>
          ...existing filter content...
        </div>
      )}
```

Note: The filter toolbar runs from line 342 to approximately line 558 (the closing `</div>` before the table wrapper). Wrap the entire section.

### 2c — `showFatSat` prop + FAT/SAT columns

- [ ] **Step 4: Add `showFatSat` to Props and thead**

In Props interface, add:
```ts
  showFatSat?: boolean;
```

In the function destructuring, add `showFatSat = false`.

In the `<thead>` first row (around line 579–580), after the Fasi `<th>` and before the delete `<th>`:

```tsx
              <th style={head}>Fasi</th>
              {showFatSat && (
                <>
                  <th colSpan={3} style={{ ...head, borderLeft: '2px solid var(--success)', color: 'var(--success)', textAlign: 'center' }}>FAT</th>
                  <th colSpan={3} style={{ ...head, borderLeft: '2px solid var(--warning, #f59e0b)', color: 'var(--warning, #f59e0b)', textAlign: 'center' }}>SAT</th>
                </>
              )}
              {onDelete !== undefined && <th style={head}></th>}
```

In the `<thead>` second row (around line 598–599), after the Fasi sub-header:

```tsx
              <th style={{ ...head, top: '33px' }}></th>
              {showFatSat && (
                <>
                  {(['✓', 'Niðurstaða', 'Prófari'] as string[]).map((h, i) => (
                    <th key={`fat-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--success)' : undefined }}>{h}</th>
                  ))}
                  {(['✓', 'Niðurstaða', 'Prófari'] as string[]).map((h, i) => (
                    <th key={`sat-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--warning, #f59e0b)' : undefined }}>{h}</th>
                  ))}
                </>
              )}
              {onDelete !== undefined && <th style={{ ...head, top: '33px' }}></th>}
```

- [ ] **Step 5: Add FAT/SAT cells in tbody**

After the Fasi `<td>` (line 1127) and before the (now conditional) delete `<td>`:

```tsx
                  <td style={{ ...cell, fontSize: '10px', color: 'var(--muted)' }}>{sig.phase_added}</td>
                  {showFatSat && (
                    <>
                      {/* FAT */}
                      <td style={{ ...cell, textAlign: 'center', borderLeft: '2px solid var(--success)' }}>
                        <input type="checkbox" checked={sig.fat_tested ?? false}
                          onChange={e => onUpdate(sig.id, { fat_tested: e.target.checked })}
                          style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ ...cell, minWidth: '60px' }}>
                        <select value={sig.fat_result ?? ''} onChange={e => onUpdate(sig.id, { fat_result: (e.target.value || null) as 'PASS' | 'FAIL' | null })}
                          style={{ ...eSelect }}>
                          <option value="">—</option>
                          <option value="PASS">PASS</option>
                          <option value="FAIL">FAIL</option>
                        </select>
                      </td>
                      <td style={{ ...cell, minWidth: '80px' }}>
                        <input value={sig.fat_tested_by ?? ''} onChange={e => onUpdate(sig.id, { fat_tested_by: e.target.value || null })}
                          style={{ ...eInput }} onFocus={onFocus} onBlur={onBlurReset} />
                      </td>
                      {/* SAT */}
                      <td style={{ ...cell, textAlign: 'center', borderLeft: '2px solid var(--warning, #f59e0b)' }}>
                        <input type="checkbox" checked={sig.sat_tested ?? false}
                          onChange={e => onUpdate(sig.id, { sat_tested: e.target.checked })}
                          style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ ...cell, minWidth: '60px' }}>
                        <select value={sig.sat_result ?? ''} onChange={e => onUpdate(sig.id, { sat_result: (e.target.value || null) as 'PASS' | 'FAIL' | null })}
                          style={{ ...eSelect }}>
                          <option value="">—</option>
                          <option value="PASS">PASS</option>
                          <option value="FAIL">FAIL</option>
                        </select>
                      </td>
                      <td style={{ ...cell, minWidth: '80px' }}>
                        <input value={sig.sat_tested_by ?? ''} onChange={e => onUpdate(sig.id, { sat_tested_by: e.target.value || null })}
                          style={{ ...eInput }} onFocus={onFocus} onBlur={onBlurReset} />
                      </td>
                    </>
                  )}
                  {onDelete && (
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                      <Button variant="danger" size="sm" onClick={() => onDelete(sig.id)}>Eyða</Button>
                    </td>
                  )}
```

- [ ] **Step 6: Build to verify no TypeScript errors**

```
npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/SignalTable.tsx
git commit -m "feat: bæta showFatSat, hideToolbar og valkvæðum onDelete við SignalTable"
```

---

## Task 3: Add `projectPhase` prop to OverviewTab from ProjectView

**Files:**
- Modify: `src/pages/ProjectView.tsx`
- Modify: `src/components/OverviewTab.tsx` (Props interface only, full rewrite in Task 4)

- [ ] **Step 1: Add projectPhase to OverviewTab Props**

In `src/components/OverviewTab.tsx`, find the Props interface (around line 12):

```ts
interface Props {
  projectId: string;
  projectName: string;
}
```

Change to:

```ts
interface Props {
  projectId: string;
  projectName: string;
  projectPhase: ProjectPhase;
}
```

Add `ProjectPhase` to the type import at the top:

```ts
import type { Bay, BaySignal, ProjectPhase, SignalState } from '../types';
```

Update the function signature:

```ts
export function OverviewTab({ projectId, projectName, projectPhase }: Props) {
```

- [ ] **Step 2: Pass `projectPhase` from ProjectView**

In `src/pages/ProjectView.tsx` (around line 1203):

```tsx
        <OverviewTab projectId={projectId} projectName={project.name} />
```

Change to:

```tsx
        <OverviewTab projectId={projectId} projectName={project.name} projectPhase={project.phase} />
```

- [ ] **Step 3: Build**

```
npm run build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/OverviewTab.tsx src/pages/ProjectView.tsx
git commit -m "feat: senda projectPhase í OverviewTab"
```

---

## Task 4: Rewrite OverviewTab — BayFile loading + dirty tracking

**Files:**
- Modify: `src/components/OverviewTab.tsx`

This task replaces the data loading and state management. The render (custom table) is kept intact for now — rendering is replaced in Task 5.

- [ ] **Step 1: Update imports**

Replace the top of `src/components/OverviewTab.tsx` with:

```ts
// src/components/OverviewTab.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { useLibrary } from '../context/LibraryContext';
import { listBayFiles, saveBay, type BayFile } from '../services/bayService';
import { loadStation } from '../services/stationService';
import { useAutoCommit } from '../github/useAutoCommit';
import { exportAllBaysToExcel, exportZenonAllBays } from '../services/exportService';
import { Button } from './ui';
import type { Bay, BaySignal, Equipment, ProjectPhase, SignalState } from '../types';
```

- [ ] **Step 2: Replace state declarations**

Replace the state block (currently `const [bays, setBays] = useState<Bay[]>([]);` and related) with:

```ts
  const [bayFiles, setBayFiles] = useState<BayFile[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [stationSignals, setStationSignals] = useState<BaySignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [stateLang, setStateLang] = useState<'is' | 'en'>('is');
  const [search, setSearch] = useState('');
  const [selectedBays, setSelectedBays] = useState<Set<string>>(new Set());
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('ALL');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');
  const [alarmOnly, setAlarmOnly] = useState(false);
  const [untestedOnly, setUntestedOnly] = useState(false);

  const bayFilesRef = useRef<BayFile[]>([]);
  bayFilesRef.current = bayFiles;
  const dirtyBayIdsRef = useRef<Set<string>>(new Set());
```

- [ ] **Step 3: Replace useEffect loading**

Replace the existing `useEffect` (currently loading Bay[] + station) with:

```ts
  useEffect(() => {
    Promise.all([
      listBayFiles(api, projectId),
      loadStation(api, projectId),
      api.readJson<Equipment[]>(`projects/${projectId}/equipment.json`),
    ]).then(([files, stationFile, { data: eq }]) => {
      setBayFiles(files);
      setStationSignals(stationFile.station.signals);
      setEquipment(eq);
    }).catch(() => setError('Gat ekki hlaðið gögnum. Reyndu aftur.'))
      .finally(() => setLoading(false));
  }, [api, projectId]);
```

- [ ] **Step 4: Add commitAll and useAutoCommit**

After the useEffect, add:

```ts
  const commitAll = async () => {
    const toSave = bayFilesRef.current.filter(f => dirtyBayIdsRef.current.has(f.bay.id));
    if (toSave.length === 0) return;
    const updated = await Promise.all(
      toSave.map(f => saveBay(api, projectId, f, projectPhase))
    );
    setBayFiles(prev => {
      const map = new Map(updated.map(f => [f.bay.id, f]));
      return prev.map(f => map.get(f.bay.id) ?? f);
    });
    dirtyBayIdsRef.current.clear();
    setIsDirty(false);
    setLastSaved(new Date());
  };

  useAutoCommit(isDirty, commitAll);
```

- [ ] **Step 5: Add handleUpdate**

```ts
  const handleUpdate = useCallback((bayId: string) => (signalId: string, patch: Partial<BaySignal>) => {
    setBayFiles(prev => prev.map(f => {
      if (f.bay.id !== bayId) return f;
      const bay: Bay = {
        ...f.bay,
        signals: f.bay.signals.map(s => s.id === signalId ? { ...s, ...patch } : s),
      };
      return { ...f, bay };
    }));
    dirtyBayIdsRef.current.add(bayId);
    setIsDirty(true);
  }, []);
```

- [ ] **Step 6: Update stateIndex and rows memos**

Replace the existing `stateIndex` and `rows` memos. The `rows` memo is no longer needed for rendering (we use per-bay sections), but keep it for the export functions and signal count:

```ts
  const stateIndex = useMemo(() => {
    const m = new Map<string, SignalState>();
    for (const s of states) m.set(s.id, s);
    return m;
  }, [states]);

  const allSignals = useMemo(() =>
    bayFiles.flatMap(f => f.bay.signals),
    [bayFiles]
  );
```

- [ ] **Step 7: Update export handlers**

The `handleExport` and `handleExportZenon` functions reference `bays`. Update them:

```ts
  const handleExport = () => {
    const syntheticStationBay: Bay = {
      id: 'station', voltage_level: '', bay_name: 'Stöðvarmerki',
      display_id: 'STÖÐ', description: null, equipment_ids: [],
      signals: stationSignals, status: 'DRAFT', review: null,
    };
    exportAllBaysToExcel([...bayFiles.map(f => f.bay), syntheticStationBay], projectName);
  };

  const handleExportZenon = () => {
    const syntheticStationBay: Bay = {
      id: 'station', voltage_level: '', bay_name: 'Stöðvarmerki',
      display_id: 'STÖÐ', description: null, equipment_ids: [],
      signals: stationSignals, status: 'DRAFT', review: null,
    };
    exportZenonAllBays([...bayFiles.map(f => f.bay), syntheticStationBay], projectName, states);
  };
```

- [ ] **Step 8: Update toggleBayFilter and bayKeys**

```ts
  const toggleBayFilter = (key: string) => {
    setSelectedBays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const bayKeys = [
    ...bayFiles.map(f => ({ key: f.bay.id, label: f.bay.display_id })),
    { key: 'station', label: 'Stöð' },
  ];
```

- [ ] **Step 9: Build to verify**

```
npm run build
```
Expected: Build succeeds. There may be TypeScript warnings about `bays` still being referenced in the render JSX — those will be fixed in Task 5.

---

## Task 5: OverviewTab render — per-bay SignalTable sections

**Files:**
- Modify: `src/components/OverviewTab.tsx`

Replace the entire JSX return (starting from the bay tab strip through the closing `</div>`) with per-bay SignalTable sections.

- [ ] **Step 1: Add SignalTable import**

Add to imports at top of file:

```ts
import { SignalTable } from './SignalTable';
```

- [ ] **Step 2: Add filtered per-bay signal memo**

Before the `return` statement, add:

```ts
  const filteredBaySignals = useMemo(() => {
    const q = search.toLowerCase().trim();
    return bayFiles.map(f => {
      const signals = f.bay.signals.filter(sig => {
        if (selectedBays.size > 0 && !selectedBays.has(f.bay.id)) return false;
        if (q) {
          const hay = [
            sig.signal_name, sig.name_is, sig.name_en ?? '',
            sig.equipment_code,
            sig.iec61850_ied ?? '', sig.iec61850_ld ?? '',
            sig.iec61850_ln ?? '', sig.iec61850_do ?? '', sig.iec61850_da ?? '',
            sig.iec61850_dataset ?? '',
          ].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (phaseFilter !== 'ALL' && sig.phase_added !== phaseFilter) return false;
        if (sourceFilter !== 'ALL' && sig.source_type !== sourceFilter) return false;
        if (alarmOnly && !sig.is_alarm) return false;
        if (untestedOnly && sig.fat_tested && sig.sat_tested) return false;
        return true;
      });
      return { file: f, signals };
    }).filter(({ signals }) => signals.length > 0);
  }, [bayFiles, search, selectedBays, phaseFilter, sourceFilter, alarmOnly, untestedOnly]);

  const filteredStationSignals = useMemo(() => {
    const q = search.toLowerCase().trim();
    return stationSignals.filter(sig => {
      if (selectedBays.size > 0 && !selectedBays.has('station')) return false;
      if (q) {
        const hay = [sig.signal_name, sig.name_is, sig.name_en ?? '', sig.equipment_code].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (phaseFilter !== 'ALL' && sig.phase_added !== phaseFilter) return false;
      if (sourceFilter !== 'ALL' && sig.source_type !== sourceFilter) return false;
      if (alarmOnly && !sig.is_alarm) return false;
      if (untestedOnly && sig.fat_tested && sig.sat_tested) return false;
      return true;
    });
  }, [stationSignals, search, selectedBays, phaseFilter, sourceFilter, alarmOnly, untestedOnly]);

  const totalVisible = filteredBaySignals.reduce((n, { signals }) => n + signals.length, 0) + filteredStationSignals.length;
  const totalAll = allSignals.length + stationSignals.length;
```

- [ ] **Step 3: Replace return JSX**

Replace the `return (...)` with:

```tsx
  if (loading || libLoading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;
  if (error) return <p style={{ color: 'var(--danger)' }}>{error}</p>;

  return (
    <div>
      {/* Bay tab strip */}
      {bayFiles.length > 0 && (
        <div style={{
          display: 'flex', overflowX: 'auto', gap: '2px',
          borderBottom: '1px solid var(--line)',
          marginBottom: 'var(--space-4)',
        }}>
          {bayFiles.map(f => {
            const flagCount = f.bay.signals.filter(s => s.review_flagged).length;
            return (
              <button
                key={f.bay.id}
                type="button"
                onClick={() => navigate(`/projects/${projectId}/bays/${f.bay.id}`)}
                style={{
                  flexShrink: 0, padding: '6px 14px', fontSize: '12px', fontWeight: 400,
                  cursor: 'pointer', background: 'none', border: 'none',
                  borderBottom: '2px solid transparent',
                  color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginBottom: '-1px',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderBottomColor = 'color-mix(in srgb, var(--accent) 40%, transparent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLButtonElement).style.borderBottomColor = 'transparent'; }}
              >
                {f.bay.display_id}
                {flagCount > 0 && (
                  <span style={{ marginLeft: '5px', fontSize: '10px', color: 'var(--danger)', fontWeight: 700 }}>💬{flagCount}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Filter row 1 */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Leit — kóði, nafn, IEC address..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...selectStyle, minWidth: '240px', flex: '1 1 240px' }} />
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

      {/* Bay chips */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: 'var(--muted)', alignSelf: 'center' }}>Reit:</span>
        {bayKeys.map(b => {
          const active = selectedBays.size === 0 || selectedBays.has(b.key);
          return (
            <button key={b.key} type="button" onClick={() => toggleBayFilter(b.key)} style={{
              padding: '2px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
              background: active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface-alt)',
              color: active ? 'var(--accent)' : 'var(--muted)', fontFamily: 'monospace',
            }}>{b.label}</button>
          );
        })}
        {selectedBays.size > 0 && (
          <button type="button" onClick={() => setSelectedBays(new Set())} style={{
            padding: '2px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--line)', background: 'none', color: 'var(--muted)', cursor: 'pointer',
          }}>Hreinsa</button>
        )}
      </div>

      {/* Filter row 2 + status + export */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
          {(['is', 'en'] as const).map(lang => (
            <button key={lang} type="button" onClick={() => setStateLang(lang)}
              style={{ padding: '2px 10px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: stateLang === lang ? 'var(--accent)' : 'transparent',
                color: stateLang === lang ? '#fff' : 'var(--text-secondary)' }}>
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={alarmOnly} onChange={e => setAlarmOnly(e.target.checked)} />
          Bara alarm
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={untestedOnly} onChange={e => setUntestedOnly(e.target.checked)} />
          Bara óprófað
        </label>
        {isDirty && <span style={{ fontSize: '12px', color: 'var(--warn)' }}>● Óvistað</span>}
        {lastSaved && !isDirty && (
          <span style={{ fontSize: '12px', color: 'var(--success)' }}>✓ Vistað {lastSaved.toLocaleTimeString('is-IS')}</span>
        )}
        <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: 'auto' }}>
          Sýnd {totalVisible} af {totalAll} merkjum
        </span>
        <Button size="sm" variant="ghost" onClick={() => commitAll()} disabled={!isDirty}>Vista núna</Button>
        <Button size="sm" variant="ghost" onClick={handleExport} disabled={totalAll === 0}>↓ Excel</Button>
        <Button size="sm" variant="ghost" onClick={handleExportZenon} disabled={totalAll === 0}>↓ zenon</Button>
      </div>

      {/* Per-bay editable sections */}
      {filteredBaySignals.map(({ file, signals }) => (
        <div key={file.bay.id} style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            marginBottom: 'var(--space-2)', paddingBottom: 'var(--space-1)',
            borderBottom: '2px solid var(--accent)',
          }}>
            <button
              type="button"
              onClick={() => navigate(`/projects/${projectId}/bays/${file.bay.id}`)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 700,
                fontSize: '13px', padding: 0,
              }}
            >
              {file.bay.display_id}
            </button>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{file.bay.bay_name}</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{signals.length} merki</span>
          </div>
          <SignalTable
            signals={signals}
            equipment={equipment}
            bayDisplayId={file.bay.display_id}
            hideToolbar
            showFatSat
            onUpdate={handleUpdate(file.bay.id)}
          />
        </div>
      ))}

      {/* Station signals — read-only */}
      {filteredStationSignals.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            marginBottom: 'var(--space-2)', paddingBottom: 'var(--space-1)',
            borderBottom: '2px solid var(--line)',
          }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: 'var(--text-secondary)' }}>STÖÐ</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Stöðvarmerki</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{filteredStationSignals.length} merki</span>
          </div>
          <SignalTable
            signals={filteredStationSignals}
            equipment={equipment}
            bayDisplayId="STÖÐ"
            hideToolbar
            showFatSat
            onUpdate={() => {}}
          />
        </div>
      )}

      {filteredBaySignals.length === 0 && filteredStationSignals.length === 0 && (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
          {totalAll === 0 ? 'Engin merki í verkefni.' : 'Engin merki passa við síu.'}
        </p>
      )}
    </div>
  );
```

- [ ] **Step 4: Remove unused code**

Remove from the file:
- The old `buildRef` function (only used by the old custom table)
- The old `ORDER` constant
- All code that was only used by the old table (stateIndex usage in old rows, etc.)
- The `stateIndex` memo (no longer needed — SignalTable handles state display internally via its own `states` prop)
- The old `rows` and `filtered` memos
- The old `handleExport` / `handleExportZenon` that referenced `bays` (replaced in Task 4)

Keep the `selectStyle` constant (still used by filter controls).

Note: `stateIndex` was used in the old table for rendering state names. `SignalTable` uses `states` prop (from `useLibrary`) internally. The `states` variable from `useLibrary` is already available in OverviewTab — pass it to SignalTable via the `states` prop:

```tsx
          <SignalTable
            signals={signals}
            equipment={equipment}
            states={states}
            bayDisplayId={file.bay.display_id}
            hideToolbar
            showFatSat
            onUpdate={handleUpdate(file.bay.id)}
          />
```

Do the same for station SignalTable.

- [ ] **Step 5: Build and test**

```
npm run build
npm test
```
Expected: Build succeeds, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/OverviewTab.tsx
git commit -m "feat: skrifa OverviewTab um - breytanlegt per-reit með SignalTable og FAT/SAT"
```

---

## Task 6: Smoke test in browser

- [ ] **Step 1: Start dev server**

```
npm run dev
```

- [ ] **Step 2: Open app and navigate to a project → Heildar-listi tab**

Verify:
- All bays appear as separate sections with their display_id as header
- SignalTable renders for each bay (editable cells)
- FAT/SAT columns visible
- Filter bar at top filters across all bays correctly
- Bay chips filter by bay
- "Sýnd X af Y merkjum" count is correct
- Station signals appear read-only at bottom

- [ ] **Step 3: Make an edit**

- Edit an IEC field in any row
- Verify "● Óvistað" appears
- Wait 30 seconds or click "Vista núna"
- Verify "✓ Vistað HH:MM:SS" appears
- Reload page and verify the edit persisted (GitHub commit was made)

- [ ] **Step 4: Test FAT/SAT**

- Check the FAT ✓ checkbox for a signal
- Verify value updates immediately
- Set FAT Niðurstaða to PASS
- Save and reload — verify persisted

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: lagfæringar eftir handprófun á heildar-lista"
```
