# Workflow Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bæta við 5 lykilþáttum í verkflæði merkjalistans: FAT/SAT prófun, fasastjórnun, Excel útflutningur, changelog og bay sniðmát.

**Architecture:** Hvert einkenni er sjálfstætt. FAT/SAT notar `fat_tested*`/`sat_tested*` reiti sem eru þegar á `BaySignal`. Fasastjórnun uppfærir `Project.phase` í `project.json`. Excel útflutningur bætir við nýrri aðgerð í `signalTemplate.ts`. Changelog vírast inn í BayView með `changelogService.ts` sem er þegar til. Bay template notar `BayTemplate` type sem er þegar skilgreindur.

**Tech Stack:** React 18 + TypeScript + Vite, SheetJS (xlsx) fyrir Excel, GitHub sem gagnagrunnur (JSON skrár).

---

## Núverandi skráarbygging

```
src/
  types.ts                    — BaySignal, Project, Testing, BayTemplate, ChangeEntry (allt þegar til)
  pages/
    BayView.tsx               — Aðal reitaryfirlit
    ProjectView.tsx           — Verkefnayfirlit
  services/
    bayService.ts             — loadBay, saveBay, listBays
    projectService.ts         — loadProject, saveProject
    changelogService.ts       — appendChange (þegar til, en ekki vísað í)
    signalTemplate.ts         — generateSignalTemplate (innflutningssniðmát)
  components/
    SignalTable.tsx            — Töfluviðmót fyrir merki
```

**Nýjar skrár:**
- `src/components/TestingPanel.tsx` — FAT/SAT prófunarviðmót
- `src/services/exportService.ts` — Excel útflutningur á raunverulegum gögnum

---

## Task 1: FAT/SAT prófunarviðmót

**Files:**
- Create: `src/components/TestingPanel.tsx`
- Modify: `src/pages/BayView.tsx`
- Modify: `src/context/ApiContext.tsx` (lesa `userName`)

Þetta bætir við "Prófa" ham í BayView. Þegar smellt er á "FAT" eða "SAT" takka opnast TestingPanel sem sýnir öll merki með PASS/FAIL/SKIP tökkunum. Þegar merki er merkt sem prófað uppfærist `fat_tested`, `fat_tested_by`, `fat_tested_at` (eða sat_) beint á BaySignal og vistast.

- [ ] **Skref 1: Búa til TestingPanel.tsx**

```tsx
// src/components/TestingPanel.tsx
import { useState } from 'react';
import { Button } from './ui';
import type { BaySignal, TestResult } from '../types';

interface Props {
  signals: BaySignal[];
  phase: 'FAT' | 'SAT';
  userName: string;
  onUpdate: (signalId: string, patch: Partial<BaySignal>) => void;
  onClose: () => void;
}

const RESULT_LABELS: Record<TestResult, string> = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  SKIP: 'SKIP',
};

const RESULT_COLORS: Record<TestResult, string> = {
  PASS: 'var(--success)',
  FAIL: 'var(--danger)',
  SKIP: 'var(--muted)',
};

export function TestingPanel({ signals, phase, userName, onUpdate, onClose }: Props) {
  const testedField = phase === 'FAT' ? 'fat_tested' : 'sat_tested';
  const testedByField = phase === 'FAT' ? 'fat_tested_by' : 'sat_tested_by';
  const testedAtField = phase === 'FAT' ? 'fat_tested_at' : 'sat_tested_at';

  const tested = signals.filter(s => s[testedField]).length;
  const pct = signals.length > 0 ? Math.round((tested / signals.length) * 100) : 0;

  const markSignal = (sig: BaySignal, result: TestResult | null) => {
    if (result === null) {
      onUpdate(sig.id, {
        [testedField]: false,
        [testedByField]: null,
        [testedAtField]: null,
      });
    } else {
      onUpdate(sig.id, {
        [testedField]: result === 'PASS' || result === 'SKIP',
        [testedByField]: userName,
        [testedAtField]: new Date().toISOString(),
      });
    }
  };

  const markAll = (result: TestResult) => {
    const now = new Date().toISOString();
    signals.forEach(sig => {
      onUpdate(sig.id, {
        [testedField]: true,
        [testedByField]: userName,
        [testedAtField]: now,
      });
    });
  };

  const cell: React.CSSProperties = {
    padding: '6px 8px',
    borderBottom: '1px solid var(--line-muted)',
    fontSize: '12px',
    verticalAlign: 'middle',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', zIndex: 200,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg)', width: '700px', display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px' }}>{phase} Prófun</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              {tested} / {signals.length} merki prófuð ({pct}%)
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <Button size="sm" variant="ghost" onClick={() => markAll('PASS')}>Allt PASS</Button>
            <Button size="sm" variant="ghost" onClick={onClose}>Loka</Button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: '4px', background: 'var(--line)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--accent)', transition: 'width 0.2s' }} />
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-alt)' }}>
                {['Tæki', 'Merki', 'Heiti', 'Niðurstaða', 'Prófað af', ''].map(h => (
                  <th key={h} style={{ ...cell, fontWeight: 600, color: 'var(--text-secondary)', position: 'sticky', top: 0, background: 'var(--surface-alt)', zIndex: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map(sig => {
                const isTested = sig[testedField] as boolean;
                const testedBy = sig[testedByField] as string | null;
                return (
                  <tr key={sig.id} style={{ background: isTested ? 'color-mix(in srgb, var(--success) 5%, transparent)' : 'transparent' }}>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>{sig.equipment_code}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent)' }}>{sig.signal_name}</td>
                    <td style={{ ...cell }}>{sig.name_is}</td>
                    <td style={{ ...cell }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {(['PASS', 'FAIL', 'SKIP'] as TestResult[]).map(r => (
                          <button key={r} type="button"
                            onClick={() => markSignal(sig, r)}
                            style={{
                              padding: '2px 8px', fontSize: '11px', fontWeight: 600,
                              border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              background: isTested && testedBy ? RESULT_COLORS[r] : 'var(--surface-alt)',
                              color: isTested && testedBy ? '#fff' : RESULT_COLORS[r],
                              opacity: (!isTested || !testedBy) && r !== 'PASS' ? 0.5 : 1,
                            }}>
                            {r}
                          </button>
                        ))}
                        {isTested && (
                          <button type="button" onClick={() => markSignal(sig, null)}
                            style={{ padding: '2px 6px', fontSize: '10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'transparent', color: 'var(--muted)' }}>
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ ...cell, fontSize: '11px', color: 'var(--muted)' }}>{testedBy ?? '—'}</td>
                    <td style={{ ...cell, textAlign: 'center', color: isTested ? 'var(--success)' : 'var(--muted)' }}>
                      {isTested ? '✓' : '○'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Skref 2: Sækja `userName` í ApiContext og tengja við BayView**

Í `src/context/ApiContext.tsx` er `userName: config.owner` þegar til. Bættu við `useApi()` import og `userName` í BayView:

```tsx
// src/pages/BayView.tsx — bæta við efst í imports
import { TestingPanel } from '../components/TestingPanel';

// Bæta við state
const { api, userName } = useApi();
const [testPhase, setTestPhase] = useState<'FAT' | 'SAT' | null>(null);

// Bæta við tökkunum í header (á eftir "Vista núna"):
<Button size="sm" variant="ghost" onClick={() => setTestPhase('FAT')}>FAT</Button>
<Button size="sm" variant="ghost" onClick={() => setTestPhase('SAT')}>SAT</Button>

// Bæta við neðst í return, á undan lokunartags </div>:
{testPhase && (
  <TestingPanel
    signals={bay.signals}
    phase={testPhase}
    userName={userName}
    onUpdate={handleUpdate}
    onClose={() => setTestPhase(null)}
  />
)}
```

- [ ] **Skref 3: TypeScript check**

```bash
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "test.ts"
```

Búist við: engar nýjar villur.

- [ ] **Skref 4: Commit**

```bash
git add src/components/TestingPanel.tsx src/pages/BayView.tsx
git commit -m "feat: FAT/SAT prófunarviðmót í BayView"
```

---

## Task 2: Fasastjórnun (Phase management)

**Files:**
- Modify: `src/pages/ProjectView.tsx`
- Modify: `src/services/projectService.ts`

Bætir við fase-tökkum í ProjectView header. Fasinn birtist vel og hægt er að fara áfram: DESIGN → FROZEN → REVIEW → FAT → SAT. Hvert skref krefst staðfestingar. FROZEN læsir merkjaskipti (þetta kemur seinna — hér er bara fasabreytingin sjálf).

- [ ] **Skref 1: Bæta `savePhase` við projectService.ts**

```typescript
// src/services/projectService.ts — bæta við neðst

export async function saveProjectPhase(
  api: GitHubApi,
  projectId: string,
  project: Project,
  sha: string,
  newPhase: ProjectPhase
): Promise<{ project: Project; sha: string }> {
  const updated: Project = { ...project, phase: newPhase };
  const msg = `[${newPhase}] Fasi uppfærður: ${project.phase} → ${newPhase}`;
  const newSha = await api.writeJson(`projects/${projectId}/project.json`, updated, sha, msg);
  return { project: updated, sha: newSha };
}
```

- [ ] **Skref 2: Bæta við fasaviðmóti í ProjectView.tsx**

Bættu við `projectSha` state og `savePhase` handler. Í header area, rétt eftir `{project.name}`, bættu við:

```tsx
// state
const [projectSha, setProjectSha] = useState('');

// í useEffect .then():
setProjectSha(files.projectSha);

// í JSX header (á eftir bays/equipment tabs):
{project && (
  <PhaseBar
    phase={project.phase}
    onAdvance={async () => {
      const ORDER: ProjectPhase[] = ['DESIGN', 'FROZEN', 'REVIEW', 'FAT', 'SAT'];
      const idx = ORDER.indexOf(project.phase);
      if (idx >= ORDER.length - 1) return;
      const next = ORDER[idx + 1];
      if (!confirm(`Fara úr ${project.phase} í ${next}?`)) return;
      const { project: updated, sha } = await saveProjectPhase(api, projectId!, project, projectSha, next);
      setProject(updated);
      setProjectSha(sha);
    }}
  />
)}
```

- [ ] **Skref 3: Búa til PhaseBar component inline í ProjectView.tsx**

Bættu við þetta component ofan `ProjectView` function:

```tsx
const PHASE_ORDER: ProjectPhase[] = ['DESIGN', 'FROZEN', 'REVIEW', 'FAT', 'SAT'];
const PHASE_LABELS: Record<ProjectPhase, string> = {
  DESIGN: 'Hönnun', FROZEN: 'Læst', REVIEW: 'Yfirferð', FAT: 'FAT', SAT: 'SAT',
};
const PHASE_COLORS: Record<ProjectPhase, string> = {
  DESIGN: 'var(--accent)', FROZEN: 'var(--text-secondary)',
  REVIEW: 'var(--warn)', FAT: '#8b5cf6', SAT: 'var(--success)',
};

function PhaseBar({ phase, onAdvance }: { phase: ProjectPhase; onAdvance: () => void }) {
  const idx = PHASE_ORDER.indexOf(phase);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
      {PHASE_ORDER.map((p, i) => (
        <React.Fragment key={p}>
          <div style={{
            padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: i === idx ? 700 : 400,
            background: i === idx ? PHASE_COLORS[p] : 'var(--surface-alt)',
            color: i === idx ? '#fff' : i < idx ? PHASE_COLORS[p] : 'var(--muted)',
            border: `1px solid ${i <= idx ? PHASE_COLORS[p] : 'var(--line)'}`,
          }}>
            {i < idx ? '✓ ' : ''}{PHASE_LABELS[p]}
          </div>
          {i < PHASE_ORDER.length - 1 && (
            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>→</span>
          )}
        </React.Fragment>
      ))}
      {idx < PHASE_ORDER.length - 1 && (
        <Button size="sm" onClick={onAdvance} style={{ marginLeft: 'var(--space-2)' }}>
          Fara í {PHASE_LABELS[PHASE_ORDER[idx + 1]]} →
        </Button>
      )}
    </div>
  );
}
```

Bæta við `import React from 'react'` ef þarf.

- [ ] **Skref 4: Sýna fase-merki í AppShell stiku þegar við erum í project**

Í `src/components/AppShell.tsx`, eftir "Reitir"/"Merki" hlekki, sýna phase badge ef við höfum hann. Þetta er aukaatriði — sleppa ef flókið.

- [ ] **Skref 5: TypeScript check**

```bash
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "test.ts"
```

- [ ] **Skref 6: Commit**

```bash
git add src/pages/ProjectView.tsx src/services/projectService.ts
git commit -m "feat: fasastjórnun DESIGN→FROZEN→REVIEW→FAT→SAT"
```

---

## Task 3: Excel útflutningur (Export raunveruleg gögn)

**Files:**
- Create: `src/services/exportService.ts`
- Modify: `src/pages/BayView.tsx`
- Modify: `src/pages/ProjectView.tsx` (valfrjálst — útflutningur á öllum reitum)

Flytur út raunveruleg merkjagögn (ekki sniðmát) sem .xlsx skrá. Ein röð á merki, öll dálkarnir.

- [ ] **Skref 1: Búa til exportService.ts**

```typescript
// src/services/exportService.ts
import * as XLSX from 'xlsx';
import type { Bay, BaySignal } from '../types';

const HEADERS = [
  'Kóði',           // display_id_equipment_signal
  'Reitur',         // bay.display_id
  'Tæki',           // equipment_code
  'Merki',          // signal_name
  'Heiti (IS)',      // name_is
  'Heiti (EN)',      // name_en
  'Uppspretta',     // source_type
  'Alarm',          // is_alarm
  'Flokkur',        // alarm_class
  'Fasi bætt við',  // phase_added
  'FAT prófað',     // fat_tested
  'FAT af',         // fat_tested_by
  'FAT dagsetning', // fat_tested_at
  'SAT prófað',     // sat_tested
  'SAT af',         // sat_tested_by
  'SAT dagsetning', // sat_tested_at
  'IEC IED',        // iec61850_ied
  'IEC LD',         // iec61850_ld
  'IEC LN',         // iec61850_ln
  'IEC LN Prefix',  // iec61850_ln_prefix
  'IEC LN Inst',    // iec61850_ln_inst
  'IEC DO/DA',      // iec61850_do_da
  'IEC FC',         // iec61850_fc
  'IEC CDC',        // iec61850_cdc
  'IEC Dataset',    // iec61850_dataset
  'IEC RCB',        // iec61850_rcb
  'IEC Dataset Entry', // iec61850_dataset_entry
];

function signalRow(bayDisplayId: string, sig: BaySignal): (string | number | boolean)[] {
  const code = [bayDisplayId, sig.equipment_code, sig.signal_name].filter(Boolean).join('_');
  return [
    code,
    bayDisplayId,
    sig.equipment_code,
    sig.signal_name,
    sig.name_is,
    sig.name_en ?? '',
    sig.source_type,
    sig.is_alarm,
    sig.alarm_class ?? '',
    sig.phase_added,
    sig.fat_tested,
    sig.fat_tested_by ?? '',
    sig.fat_tested_at ? new Date(sig.fat_tested_at).toLocaleDateString('is-IS') : '',
    sig.sat_tested,
    sig.sat_tested_by ?? '',
    sig.sat_tested_at ? new Date(sig.sat_tested_at).toLocaleDateString('is-IS') : '',
    sig.iec61850_ied ?? '',
    sig.iec61850_ld ?? '',
    sig.iec61850_ln ?? '',
    sig.iec61850_ln_prefix ?? '',
    sig.iec61850_ln_inst ?? '',
    sig.iec61850_do_da ?? '',
    sig.iec61850_fc ?? '',
    sig.iec61850_cdc ?? '',
    sig.iec61850_dataset ?? '',
    sig.iec61850_rcb ?? '',
    sig.iec61850_dataset_entry ?? '',
  ];
}

export function exportBayToExcel(bay: Bay): void {
  const rows = bay.signals.map(s => signalRow(bay.display_id, s));
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  ws['!cols'] = [
    20, 12, 10, 16, 36, 36, 12, 8, 8, 10,
    10, 14, 14, 10, 14, 14,
    14, 10, 10, 12, 10, 16, 6, 10, 16, 16, 18,
  ].map(w => ({ wch: w }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, bay.display_id.substring(0, 31));
  XLSX.writeFile(wb, `${bay.display_id}-merki.xlsx`);
}

export function exportAllBaysToExcel(bays: Bay[], projectName: string): void {
  const allRows = bays.flatMap(bay => bay.signals.map(s => signalRow(bay.display_id, s)));
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...allRows]);
  ws['!cols'] = [
    20, 12, 10, 16, 36, 36, 12, 8, 8, 10,
    10, 14, 14, 10, 14, 14,
    14, 10, 10, 12, 10, 16, 6, 10, 16, 16, 18,
  ].map(w => ({ wch: w }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Merki');
  XLSX.writeFile(wb, `${projectName}-merkjalisti.xlsx`);
}
```

- [ ] **Skref 2: Bæta við útflutnings-takka í BayView header**

```tsx
// src/pages/BayView.tsx — bæta við import
import { exportBayToExcel } from '../services/exportService';

// Í header takkum, á eftir "↑ Innflutningur":
<Button size="sm" variant="ghost" onClick={() => exportBayToExcel(bay)}>↓ Excel</Button>
```

- [ ] **Skref 3: Bæta við útflutnings-takka í ProjectView**

```tsx
// src/pages/ProjectView.tsx — bæta við import
import { exportAllBaysToExcel } from '../services/exportService';

// Í bays tab header, á eftir "Nýr reitur" takka:
<Button size="sm" variant="ghost" onClick={() => exportAllBaysToExcel(bays, project?.name ?? 'verkefni')}>
  ↓ Excel (allt)
</Button>
```

- [ ] **Skref 4: TypeScript check**

```bash
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "test.ts"
```

- [ ] **Skref 5: Commit**

```bash
git add src/services/exportService.ts src/pages/BayView.tsx src/pages/ProjectView.tsx
git commit -m "feat: Excel útflutningur á raunverulegum merkjagögnum"
```

---

## Task 4: Changelog

**Files:**
- Modify: `src/pages/BayView.tsx`
- Modify: `src/pages/ProjectView.tsx`
- Create: `src/components/ChangelogTab.tsx`

`changelogService.ts` er þegar til með `appendChange()`. Hér er það vísað inn í BayView og birtt í ProjectView fána.

- [ ] **Skref 1: Kalla á appendChange í BayView við merki-breytingar**

```tsx
// src/pages/BayView.tsx — bæta við import
import { appendChange } from '../services/changelogService';

// Breyta handleAdd til að skrá í changelog
const handleAdd = (signals: BaySignal[]) => {
  setBayFile(prev => {
    if (!prev) return prev;
    return { ...prev, bay: { ...prev.bay, signals: [...prev.bay.signals, ...signals] } };
  });
  setIsDirty(true);
  setShowPicker(false);
  // Skrá í changelog (fire-and-forget)
  signals.forEach(sig => {
    appendChange(api, projectId!, {
      user: userName,
      phase: 'DESIGN',
      type: 'SIGNAL_ADDED',
      target_id: sig.id,
      target_type: 'signal',
      field: null,
      old_value: null,
      new_value: `${sig.equipment_code}_${sig.signal_name}`,
      comment: `Merki bætt við: ${sig.signal_name} í ${bayFileRef.current?.bay.display_id}`,
    });
  });
};

// Breyta handleDelete
const handleDelete = (signalId: string) => {
  const sig = bayFileRef.current?.bay.signals.find(s => s.id === signalId);
  setBayFile(prev => {
    if (!prev) return prev;
    return { ...prev, bay: { ...prev.bay, signals: prev.bay.signals.filter(s => s.id !== signalId) } };
  });
  setIsDirty(true);
  if (sig) {
    appendChange(api, projectId!, {
      user: userName,
      phase: 'DESIGN',
      type: 'SIGNAL_REMOVED',
      target_id: signalId,
      target_type: 'signal',
      field: null,
      old_value: `${sig.equipment_code}_${sig.signal_name}`,
      new_value: null,
      comment: `Merki eytt: ${sig.signal_name}`,
    });
  }
};
```

- [ ] **Skref 2: Búa til ChangelogTab.tsx**

```tsx
// src/components/ChangelogTab.tsx
import { useEffect, useState } from 'react';
import { useApi } from '../context/ApiContext';
import type { ChangeEntry, ProjectPhase } from '../types';

const TYPE_LABELS: Record<string, string> = {
  SIGNAL_ADDED: 'Merki bætt við',
  SIGNAL_REMOVED: 'Merki eytt',
  FIELD_CHANGED: 'Reitur breyttur',
  PHASE_CHANGED: 'Fasi breyttur',
  REVIEW_ADDED: 'Yfirferð',
  FAT_TESTED: 'FAT prófað',
  SAT_TESTED: 'SAT prófað',
};

const PHASE_COLORS: Partial<Record<ProjectPhase, string>> = {
  DESIGN: 'var(--accent)', FROZEN: 'var(--text-secondary)',
  REVIEW: 'var(--warn)', FAT: '#8b5cf6', SAT: 'var(--success)',
};

interface Props {
  projectId: string;
}

export function ChangelogTab({ projectId }: Props) {
  const { api } = useApi();
  const [entries, setEntries] = useState<ChangeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.readJson<ChangeEntry[]>(`projects/${projectId}/changelog.json`)
      .then(({ data }) => setEntries([...data].reverse()))
      .finally(() => setLoading(false));
  }, [api, projectId]);

  if (loading) return <p style={{ color: 'var(--muted)', padding: 'var(--space-4)' }}>Hleður...</p>;
  if (entries.length === 0) return <p style={{ color: 'var(--muted)', padding: 'var(--space-4)' }}>Engar breytingar skráðar.</p>;

  return (
    <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
      {entries.map(e => (
        <div key={e.id} style={{
          display: 'grid', gridTemplateColumns: '130px 80px 120px 1fr',
          gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--line-muted)', fontSize: '12px', alignItems: 'start',
        }}>
          <span style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: '11px' }}>
            {new Date(e.timestamp).toLocaleString('is-IS')}
          </span>
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
            background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
            color: PHASE_COLORS[e.phase] ?? 'var(--accent)',
          }}>
            {e.phase}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>{TYPE_LABELS[e.type] ?? e.type}</span>
          <span style={{ color: 'var(--text)' }}>
            {e.comment}
            {e.user && <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>— {e.user}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Skref 3: Bæta við changelog fána í ProjectView**

```tsx
// src/pages/ProjectView.tsx — bæta við 'changelog' í Tab type
type Tab = 'bays' | 'equipment' | 'station' | 'overview' | 'changelog';

// Bæta við import
import { ChangelogTab } from '../components/ChangelogTab';

// Bæta við fána í tab lista (á eftir 'station'):
{ id: 'changelog', label: 'Breytingasaga' }

// Í tab content section, bæta við:
{tab === 'changelog' && projectId && <ChangelogTab projectId={projectId} />}
```

- [ ] **Skref 4: TypeScript check**

```bash
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "test.ts"
```

- [ ] **Skref 5: Commit**

```bash
git add src/pages/BayView.tsx src/components/ChangelogTab.tsx src/pages/ProjectView.tsx
git commit -m "feat: changelog — skrá og sýna breytingasögu"
```

---

## Task 5: Bay sniðmát (Bay template)

**Files:**
- Modify: `src/pages/BayView.tsx`
- Modify: `src/pages/NewBay.tsx`
- Modify: `src/services/bayService.ts`

`BayTemplate` type er þegar til í types.ts. Sniðmát eru vistuð í `data/bay_templates/` í GitHub repo. Þegar nýr reitur er búinn til má velja sniðmát sem fyller sjálfkrafa merki.

- [ ] **Skref 1: Bæta `saveBayTemplate` og `listBayTemplates` við bayService.ts**

```typescript
// src/services/bayService.ts — bæta við neðst
import type { BayTemplate } from '../types';

export async function saveBayTemplate(
  api: GitHubApi,
  bay: Bay,
  templateName: string
): Promise<void> {
  const template: BayTemplate = {
    template_name: templateName,
    station: bay.station,
    voltage_level: bay.voltage_level,
    bay_name: bay.bay_name,
    display_id: bay.display_id,
    equipment_codes: [],  // equipment_ids eru verkefnaháð, ekki flutt yfir
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

export async function listBayTemplates(api: GitHubApi): Promise<BayTemplate[]> {
  try {
    const entries = await api.listDirectory('data/bay_templates');
    const results = await Promise.allSettled(
      entries.filter(e => e.endsWith('.json'))
        .map(f => api.readJson<BayTemplate>(`data/bay_templates/${f}`))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<{ data: BayTemplate; sha: string }> => r.status === 'fulfilled')
      .map(r => r.value.data);
  } catch {
    return [];
  }
}
```

- [ ] **Skref 2: Bæta við "Vista sem sniðmát" takka í BayView**

```tsx
// src/pages/BayView.tsx — bæta við import
import { saveBayTemplate } from '../services/bayService';

// State
const [savingTemplate, setSavingTemplate] = useState(false);

const handleSaveTemplate = async () => {
  const name = prompt('Nafn á sniðmáti:', bay.display_id);
  if (!name) return;
  setSavingTemplate(true);
  try {
    await saveBayTemplate(api, bay, name);
    alert(`Sniðmát "${name}" vistað.`);
  } finally {
    setSavingTemplate(false);
  }
};

// Í header takkum:
<Button size="sm" variant="ghost" onClick={handleSaveTemplate} disabled={savingTemplate}>
  ⊕ Vista sem sniðmát
</Button>
```

- [ ] **Skref 3: Bæta við sniðmátsval í NewBay.tsx**

Lesa `NewBay.tsx` fyrst til að skilja núverandi form. Bæta við dropdown sem hleður `listBayTemplates()` og þegar valið er fyllist `signals` sjálfkrafa.

```tsx
// src/pages/NewBay.tsx — bæta við import
import { listBayTemplates } from '../services/bayService';
import type { BayTemplate } from '../types';

// State í NewBay component
const [templates, setTemplates] = useState<BayTemplate[]>([]);
const [selectedTemplate, setSelectedTemplate] = useState('');

// Í useEffect (eða sérstakt useEffect):
listBayTemplates(api).then(setTemplates);

// Í form, á undan "Vista" takka:
{templates.length > 0 && (
  <div>
    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
      Nota sniðmát (valfrjálst)
    </label>
    <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}
      style={{ width: '100%', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '6px 8px', fontSize: '13px', outline: 'none' }}>
      <option value="">— engin —</option>
      {templates.map((t, i) => <option key={i} value={t.template_name}>{t.template_name}</option>)}
    </select>
  </div>
)}
```

Þegar `createBay` er kallað, ef `selectedTemplate` er valið, finndu sniðmátið og sendu `signals` með `phase_added: currentPhase`:

```tsx
const tmpl = templates.find(t => t.template_name === selectedTemplate);
const signals = tmpl
  ? tmpl.signals.map(s => ({ ...s, id: uuid(), phase_added: 'DESIGN' as const }))
  : [];
await createBay(api, projectId, station, voltageLevel, bayName, signals, userName);
```

- [ ] **Skref 4: TypeScript check**

```bash
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "test.ts"
```

- [ ] **Skref 5: Commit**

```bash
git add src/services/bayService.ts src/pages/BayView.tsx src/pages/NewBay.tsx
git commit -m "feat: bay sniðmát — vista og nota reit sem sniðmát"
```

---

## Sjálfsyfirferð

**1. Spec coverage:**
- ✅ Task 1: FAT/SAT prófun — TestingPanel með PASS/FAIL/SKIP, progress bar, "Allt PASS"
- ✅ Task 2: Fasastjórnun — PhaseBar með DESIGN→FROZEN→REVIEW→FAT→SAT
- ✅ Task 3: Excel útflutningur — exportBayToExcel og exportAllBaysToExcel
- ✅ Task 4: Changelog — appendChange í BayView, ChangelogTab í ProjectView
- ✅ Task 5: Bay sniðmát — saveBayTemplate, listBayTemplates, sniðmátsval í NewBay

**2. Placeholder scan:** Engin TBD eða TODO.

**3. Type consistency:**
- `BayTemplate.signals` er `Omit<BaySignal, 'phase_added'>[]` — þegar skilgreint í types.ts
- `TestResult` er `'PASS' | 'FAIL' | 'SKIP'` — þegar skilgreint
- `appendChange` tekur `NewEntry = Omit<ChangeEntry, 'id' | 'timestamp'>` — passa sig á að senda rétta reiti
- `saveBayTemplate` importar `BayTemplate` type sem þarf að bæta við import í `bayService.ts`
