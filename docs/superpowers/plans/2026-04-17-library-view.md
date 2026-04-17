# Library View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Búa til global `/library` síðu með þremur flipum — Merkjasafn (signal library), Stöður (signal states), og Sniðmát (templates) — og tengja hana í AppShell nav.

**Architecture:** `LibraryView.tsx` er ein ný síða með `tab` state (`'signals' | 'states' | 'templates'`). Merkjasafn flipinn er endurvinnsla af `SignalsView.tsx` með project-picker fyrir "bæta við í reit" í staðinn fyrir `useParams`. Stöður og Sniðmát flipar eru read-only töflur úr `data/` skránum. `/library` route bætist við `App.tsx`. AppShell `Merki` hlekkur fer í `/library`.

**Tech Stack:** React 18 + TypeScript + Vite, GitHub sem JSON gagnagrunnur, `listProjects` + `listBays` + `loadBay` + `saveBay` frá services, `listBayTemplates` frá bayService.

---

## Skráarbygging

| Skrá | Breyting |
|------|----------|
| `src/pages/LibraryView.tsx` | Ný skrá — öll library UI með þremur flipum |
| `src/App.tsx` | Bæta við `/library` route |
| `src/components/AppShell.tsx` | Breyta "Merki" hlekkinn úr project-specific í `/library` |

`SignalsView.tsx` og `/projects/:projectId/signals` route eru **óbreytt** — við eyðum ekki gömlu skránni.

---

## Task 1: LibraryView shell + route + nav

**Files:**
- Create: `src/pages/LibraryView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppShell.tsx`

### Bakgrunnur

`App.tsx` er í `/Users/teddi/Documents/merkjalisti/src/App.tsx`. Routes eru innan `<AppShell>` parent route. `/library` á að vera barnroute líkt og `/projects/new`.

`AppShell.tsx` er í `/Users/teddi/Documents/merkjalisti/src/components/AppShell.tsx`. Hann sýnir "Merki" hlekk þegar notandi er í verkefni (`projectId` er til). Við breytum þessum hlekknum yfir í `/library` og fjarlægjum project-specific tengingu.

- [ ] **Skref 1: Búa til `src/pages/LibraryView.tsx` með þremur flipum**

```tsx
// src/pages/LibraryView.tsx
import { useState } from 'react';

type LibTab = 'signals' | 'states' | 'templates';

export function LibraryView() {
  const [tab, setTab] = useState<LibTab>('signals');

  const tabStyle = (t: LibTab): React.CSSProperties => ({
    background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer',
    fontSize: '13px', fontWeight: tab === t ? 600 : 400,
    color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    marginBottom: '-1px',
  });

  return (
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
        Library
      </h1>
      <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--line)', marginBottom: 'var(--space-6)' }}>
        <button type="button" style={tabStyle('signals')} onClick={() => setTab('signals')}>Merkjasafn</button>
        <button type="button" style={tabStyle('states')} onClick={() => setTab('states')}>Stöður</button>
        <button type="button" style={tabStyle('templates')} onClick={() => setTab('templates')}>Sniðmát</button>
      </div>

      {tab === 'signals' && <p style={{ color: 'var(--muted)' }}>Merkjasafn — kemur í Task 2</p>}
      {tab === 'states' && <p style={{ color: 'var(--muted)' }}>Stöður — kemur í Task 3</p>}
      {tab === 'templates' && <p style={{ color: 'var(--muted)' }}>Sniðmát — kemur í Task 4</p>}
    </div>
  );
}
```

- [ ] **Skref 2: Bæta `/library` route við `App.tsx`**

Núverandi `App.tsx` lítur svona út:

```tsx
import { SignalsView } from './pages/SignalsView';
// ... fleiri imports

<Route element={<AppShell />}>
  <Route index element={<Dashboard />} />
  <Route path="projects/new" element={<NewProject />} />
  <Route path="projects/:projectId" element={<ProjectView />} />
  <Route path="projects/:projectId/bays/new" element={<NewBay />} />
  <Route path="projects/:projectId/bays/:bayId" element={<BayView />} />
  <Route path="projects/:projectId/signals" element={<SignalsView />} />
  <Route path="*" element={<NotFound />} />
</Route>
```

Bæta við import og route:

```tsx
import { LibraryView } from './pages/LibraryView';

// Bæta við þessari línu Á EFT `projects/:projectId/signals`:
<Route path="library" element={<LibraryView />} />
```

- [ ] **Skref 3: Uppfæra AppShell — "Merki" hlekk breytist í `/library`**

Núverandi AppShell hefur þessa tvo hlekkja þegar í verkefni:
```tsx
<NavLink to={`/projects/${projectId}`} end style={navStyle}>
  <span>⬡</span><span>Reitir</span>
</NavLink>
<NavLink to={`/projects/${projectId}/signals`} style={navStyle}>
  <span>≡</span><span>Merki</span>
</NavLink>
```

Breyta `Merki` hlekki í `/library` og fjarlægja project-bindingu:

```tsx
<NavLink to={`/projects/${projectId}`} end style={navStyle}>
  <span>⬡</span><span>Reitir</span>
</NavLink>
```

Þ.e.: eyða `Merki` hlekk úr project-context hlutanum (hann er nú þegar í global nav sem `/library`).

- [ ] **Skref 4: TypeScript check**

```bash
cd /Users/teddi/Documents/merkjalisti && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "test\." | grep "error TS"
```

Búast við: engar villur.

- [ ] **Skref 5: Commit**

```bash
cd /Users/teddi/Documents/merkjalisti
git add src/pages/LibraryView.tsx src/App.tsx src/components/AppShell.tsx
git commit -m "feat: LibraryView shell + /library route + nav uppfærsla"
```

---

## Task 2: Merkjasafn flipi — global signal library

**Files:**
- Modify: `src/pages/LibraryView.tsx`

### Bakgrunnur

`SignalsView.tsx` les `data/signal_library.json` (global), `listBays(api, projectId)` (project-specific), og gerir allt í einu component. Við þurfum sömu virkni en án fast `projectId` — í staðinn hleðst project listi og notandi velur verkefni þegar hann vill bæta merki við reit.

Þjónustur sem þarf:
- `listProjects(api): Promise<Project[]>` — frá `src/services/projectService.ts`
- `listBays(api, projectId): Promise<Bay[]>` — frá `src/services/bayService.ts`
- `loadBay(api, projectId, bayId): Promise<BayFile>` — frá `src/services/bayService.ts`
- `saveBay(api, projectId, bayFile, phase): Promise<BayFile>` — frá `src/services/bayService.ts`

`useApi()` gefur `{ api, userName }` frá `src/context/ApiContext.tsx`.

`SignalLibraryEntry` og `BaySignal` eru týpur í `src/types.ts`.

Þetta er stór flipi — lykillinn er að lifa án `useParams`. "Bæta við í reit" gluggi fær nýjan "Verkefni" dropdown efst.

- [ ] **Skref 1: Bæta við imports og state í LibraryView**

Neðst í `LibraryView.tsx`, rétt á undan `export function LibraryView()`, bæta við hjálparfalli:

```tsx
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
```

Uppfæra imports efst í skránni:

```tsx
import { useEffect, useState } from 'react';
import { useApi } from '../context/ApiContext';
import { listProjects } from '../services/projectService';
import { listBays, loadBay, saveBay } from '../services/bayService';
import { Button } from '../components/ui';
import type { SignalLibraryEntry, BaySignal, Bay, Project, AlarmClass, SourceType } from '../types';
```

- [ ] **Skref 2: Búa til `SignalsTab` component í sömu skrá**

Bæta við þessum component FYRIR `LibraryView` fallið (en eftir `uuid` hjálparfallið):

```tsx
function SignalsTab() {
  const { api, userName } = useApi();

  const [library, setLibrary] = useState<SignalLibraryEntry[]>([]);
  const [libSha, setLibSha] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [bays, setBays] = useState<Bay[]>([]);
  const [search, setSearch] = useState('');
  const [lang, setLang] = useState<'is' | 'en'>('is');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<SignalLibraryEntry | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [targetBayId, setTargetBayId] = useState('');
  const [equipmentCode, setEquipmentCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // New/edit signal form
  const emptyNew = (): Partial<SignalLibraryEntry> => ({
    code: '', name_is: '', name_en: null, is_alarm: false, alarm_class: null,
    source_type: 'IED', iec61850_ld: null, iec61850_ln: null,
    iec61850_do_da: null, iec61850_fc: null, iec61850_cdc: null,
    iec61850_dataset: null, description_is: null, state_id: null,
    signal_type: null, units: null, severity_code: null,
    hmi_event: false, to_control_room: false, comments: null,
  });
  const [newOpen, setNewOpen] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<SignalLibraryEntry>>(emptyNew());
  const [newSaving, setNewSaving] = useState(false);
  const [editEntry, setEditEntry] = useState<Partial<SignalLibraryEntry> | null>(null);
  const [editOrigCode, setEditOrigCode] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.readJson<SignalLibraryEntry[]>('data/signal_library.json'),
      listProjects(api),
    ]).then(([{ data: lib, sha }, projectList]) => {
      // Migration: add IDs to entries that are missing them
      const needsMigration = lib.some(e => !e.id);
      if (needsMigration) {
        const migrated = lib.map(e => e.id ? e : { ...e, id: uuid() });
        api.writeJson('data/signal_library.json', migrated, sha, 'Migration: bæta við ID').then(newSha => {
          setLibrary(migrated);
          setLibSha(newSha);
        });
      } else {
        setLibrary(lib);
        setLibSha(sha);
      }
      setProjects(projectList);
    }).finally(() => setLoading(false));
  }, [api]);

  // When project selected, load bays
  useEffect(() => {
    if (!selectedProjectId) { setBays([]); return; }
    listBays(api, selectedProjectId).then(setBays).catch(() => setBays([]));
  }, [api, selectedProjectId]);

  const buildEntry = (form: Partial<SignalLibraryEntry>, existingId?: string): SignalLibraryEntry => ({
    id: existingId ?? uuid(),
    code: form.code?.trim().toUpperCase() ?? null,
    name_is: form.name_is?.trim() ?? '',
    name_en: form.name_en || null,
    description_is: form.description_is || null,
    state_id: form.state_id || null,
    signal_type: form.signal_type || null,
    units: form.units || null,
    severity_code: form.severity_code || null,
    hmi_event: form.hmi_event ?? false,
    is_alarm: form.is_alarm ?? false,
    alarm_class: form.is_alarm ? (form.alarm_class ?? 1) : null,
    to_control_room: form.to_control_room ?? false,
    source_type: (form.source_type ?? 'IED') as SourceType,
    iec61850_ld: form.iec61850_ld || null,
    iec61850_ln: form.iec61850_ln || null,
    iec61850_do_da: form.iec61850_do_da || null,
    iec61850_fc: form.iec61850_fc || null,
    iec61850_cdc: form.iec61850_cdc || null,
    iec61850_dataset: form.iec61850_dataset || null,
    comments: form.comments || null,
  });

  const handleSaveNew = async () => {
    if (!newEntry.code?.trim() || !newEntry.name_is?.trim()) return;
    setNewSaving(true);
    try {
      const entry = buildEntry(newEntry);
      const newLib = [...library, entry];
      const sha = await api.writeJson('data/signal_library.json', newLib, libSha, `Nýtt merki: ${entry.code}`);
      setLibrary(newLib);
      setLibSha(sha);
      setNewOpen(false);
      setNewEntry(emptyNew());
    } finally { setNewSaving(false); }
  };

  const handleSaveEdit = async () => {
    if (!editEntry?.id || !editEntry.code?.trim() || !editEntry.name_is?.trim()) return;
    setNewSaving(true);
    try {
      const updated = buildEntry(editEntry, editEntry.id);
      const newLib = library.map(e => e.id === updated.id ? updated : e);
      const sha = await api.writeJson('data/signal_library.json', newLib, libSha, `Uppfæra merki: ${updated.code}`);
      setLibrary(newLib);
      setLibSha(sha);
      setEditEntry(null);
      setEditOrigCode(null);
    } finally { setNewSaving(false); }
  };

  const toSignal = (e: SignalLibraryEntry, eqCode: string): BaySignal => ({
    id: uuid(),
    equipment_code: eqCode,
    signal_name: e.code ?? '',
    library_id: e.id,
    name_is: e.name_is,
    name_en: e.name_en ?? null,
    state_id: e.state_id ?? null,
    iec61850_ied: null, iec61850_ln_prefix: null, iec61850_ln_inst: null,
    iec61850_rcb: null, iec61850_dataset_entry: null,
    iec61850_ld: e.iec61850_ld ?? null,
    iec61850_ln: e.iec61850_ln ?? null,
    iec61850_do_da: e.iec61850_do_da ?? null,
    iec61850_fc: e.iec61850_fc ?? null,
    iec61850_cdc: e.iec61850_cdc ?? null,
    iec61850_dataset: e.iec61850_dataset ?? null,
    is_alarm: e.is_alarm,
    alarm_class: e.alarm_class ?? null,
    state_alarm_map: null,
    source_type: e.source_type,
    phase_added: 'DESIGN',
    fat_tested: false, fat_tested_by: null, fat_tested_at: null, fat_result: null,
    sat_tested: false, sat_tested_by: null, sat_tested_at: null, sat_result: null,
    review_flagged: false,
    review_comment: null,
  });

  const handleAdd = async () => {
    if (!targetBayId || !equipmentCode.trim() || !selectedProjectId) return;
    const eqCode = equipmentCode.trim().toUpperCase();
    const entries = adding ? [adding] : library.filter(e => e.code && selected.has(e.code));
    if (entries.length === 0) return;
    setSaving(true);
    try {
      const { bay, sha } = await loadBay(api, selectedProjectId, targetBayId);
      const newSignals = entries.map(e => toSignal(e, eqCode));
      await saveBay(api, selectedProjectId, { bay: { ...bay, signals: [...bay.signals, ...newSignals] }, sha }, 'DESIGN');
      setAdding(null);
      setBulkOpen(false);
      setSelected(new Set());
      setTargetBayId('');
      setEquipmentCode('');
    } finally { setSaving(false); }
  };

  const q = search.toLowerCase().trim();
  const filtered = q
    ? library.filter(e =>
        (e.code?.toLowerCase().includes(q) ?? false) ||
        e.name_is.toLowerCase().includes(q) ||
        (e.name_en?.toLowerCase().includes(q) ?? false)
      )
    : library;

  const toggleSelect = (code: string) => setSelected(prev => {
    const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n;
  });
  const allFilteredCodes = filtered.map(e => e.code).filter(Boolean) as string[];
  const allSelected = allFilteredCodes.length > 0 && allFilteredCodes.every(c => selected.has(c));
  const toggleAll = () => setSelected(allSelected
    ? new Set([...selected].filter(c => !allFilteredCodes.includes(c)))
    : new Set([...selected, ...allFilteredCodes])
  );

  const cell: React.CSSProperties = {
    padding: '5px 8px', borderBottom: '1px solid var(--line-muted)',
    fontSize: '12px', verticalAlign: 'middle',
  };
  const head: React.CSSProperties = {
    ...cell, fontWeight: 600, color: 'var(--text-secondary)',
    background: 'var(--surface-alt)', whiteSpace: 'nowrap',
    position: 'sticky', top: 0, zIndex: 1,
  };
  const modalInput: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--surface-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '6px 8px', fontSize: '13px', outline: 'none',
  };
  const dropdownStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '6px 8px', fontSize: '13px', marginBottom: 'var(--space-3)', outline: 'none',
  };

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <input
          type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Leita að kóða eða heiti..."
          style={{ flex: 1, maxWidth: '400px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '6px 10px', fontSize: '13px', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
          {(['is', 'en'] as const).map(l => (
            <button key={l} type="button" onClick={() => setLang(l)}
              style={{ padding: '2px 10px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: lang === l ? 'var(--accent)' : 'transparent',
                color: lang === l ? '#fff' : 'var(--text-secondary)' }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        {search && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{filtered.length} niðurstöður</span>}
        <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: 'auto' }}>{library.length} merki</span>
        <Button size="sm" onClick={() => { setNewOpen(true); setNewEntry(emptyNew()); }}>+ Nýtt merki</Button>
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          padding: 'var(--space-2) var(--space-4)',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
          marginBottom: 'var(--space-3)', fontSize: '13px',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{selected.size} merki valin</span>
          <Button size="sm" onClick={() => { setBulkOpen(true); setTargetBayId(''); setEquipmentCode(''); }}>+ Bæta við í reit</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Hætta við val</Button>
        </div>
      )}

      {/* Table */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={head}><input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer' }} /></th>
                {['Kóði', 'Texti', 'Alarm', 'Fl.', 'Uppspretta', 'LD', 'LN', 'DO/DA', ''].map(h => (
                  <th key={h} style={head}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={10} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-8)' }}>
                  {search ? 'Ekkert fannst' : 'Tómt safn'}
                </td></tr>
              )}
              {filtered.map((e, i) => {
                const code = e.code ?? '';
                const isSel = selected.has(code);
                return (
                  <tr key={e.id}
                    style={{ background: isSel ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)', cursor: 'pointer' }}
                    onClick={() => code && toggleSelect(code)}>
                    <td style={{ ...cell, width: '32px', textAlign: 'center' }} onClick={ev => ev.stopPropagation()}>
                      <input type="checkbox" checked={isSel} onChange={() => code && toggleSelect(code)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{code || '—'}</td>
                    <td style={{ ...cell }}>{lang === 'is' ? e.name_is : (e.name_en ?? <span style={{ color: 'var(--muted)' }}>—</span>)}</td>
                    <td style={{ ...cell, textAlign: 'center', color: e.is_alarm ? 'var(--danger)' : 'var(--muted)' }}>{e.is_alarm ? '●' : '—'}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>{e.is_alarm && e.alarm_class ? `F${e.alarm_class}` : '—'}</td>
                    <td style={{ ...cell, fontSize: '11px', color: 'var(--muted)' }}>{e.source_type}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>{e.iec61850_ld ?? '—'}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>{e.iec61850_ln ?? '—'}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>{e.iec61850_do_da ?? '—'}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }} onClick={ev => ev.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <Button size="sm" variant="ghost" onClick={() => { setAdding(e); setTargetBayId(''); setEquipmentCode(''); }}>+ Bay</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditEntry({ ...e }); setEditOrigCode(e.code); }}>✏</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add to bay dialog */}
      {(adding || bulkOpen) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) { setAdding(null); setBulkOpen(false); } }}>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 'var(--space-6)', minWidth: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: 'var(--space-1)' }}>Bæta við í reit</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: 'var(--space-4)' }}>
              {adding
                ? <><span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{adding.code}</span> — {adding.name_is}</>
                : <><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selected.size} merki</span> valin</>
              }
            </div>

            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Verkefni</label>
            <select value={selectedProjectId} onChange={e => { setSelectedProjectId(e.target.value); setTargetBayId(''); }} style={dropdownStyle}>
              <option value="">— veldu verkefni —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Reitur</label>
            <select value={targetBayId} onChange={e => setTargetBayId(e.target.value)} style={dropdownStyle} disabled={!selectedProjectId}>
              <option value="">— veldu reit —</option>
              {bays.map(b => <option key={b.id} value={b.id}>{b.display_id}</option>)}
            </select>

            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tækjakóði</label>
            <input value={equipmentCode} onChange={e => setEquipmentCode(e.target.value.toUpperCase())}
              placeholder="t.d. QA1"
              style={{ ...modalInput, fontFamily: 'monospace', marginBottom: 'var(--space-4)' }} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <Button variant="ghost" onClick={() => { setAdding(null); setBulkOpen(false); }}>Hætta við</Button>
              <Button onClick={handleAdd} disabled={!selectedProjectId || !targetBayId || !equipmentCode.trim() || saving}>
                {saving ? 'Vista...' : adding ? 'Bæta við' : `Bæta við (${selected.size})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New/Edit signal modal */}
      {(newOpen || editEntry) && (() => {
        const isEdit = !!editEntry;
        const form = isEdit ? editEntry! : newEntry;
        const setForm = isEdit
          ? (fn: (p: Partial<SignalLibraryEntry>) => Partial<SignalLibraryEntry>) => setEditEntry(prev => prev ? fn(prev) : prev)
          : (fn: (p: Partial<SignalLibraryEntry>) => Partial<SignalLibraryEntry>) => setNewEntry(fn);
        const onClose = () => isEdit ? (setEditEntry(null), setEditOrigCode(null)) : setNewOpen(false);
        const onSave = isEdit ? handleSaveEdit : handleSaveNew;

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 'var(--space-6)', width: '480px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: 'var(--space-4)' }}>
                {isEdit ? `Breyta merki — ${editOrigCode}` : 'Nýtt merki í safn'}
              </div>

              {([
                ['Kóði *', 'code', 'monospace'],
                ['Heiti (IS) *', 'name_is', 'inherit'],
                ['Heiti (EN)', 'name_en', 'inherit'],
                ['IEC 61850 LD', 'iec61850_ld', 'monospace'],
                ['IEC 61850 LN', 'iec61850_ln', 'monospace'],
                ['DO/DA', 'iec61850_do_da', 'monospace'],
                ['FC', 'iec61850_fc', 'monospace'],
                ['CDC', 'iec61850_cdc', 'monospace'],
                ['Dataset', 'iec61850_dataset', 'monospace'],
              ] as [string, keyof SignalLibraryEntry, string][]).map(([label, field, ff]) => (
                <div key={field} style={{ marginBottom: 'var(--space-3)' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</label>
                  <input
                    value={(form[field] as string | null) ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value || null }))}
                    style={{ ...modalInput, fontFamily: ff }}
                  />
                </div>
              ))}

              <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_alarm ?? false}
                    onChange={e => setForm(prev => ({ ...prev, is_alarm: e.target.checked, alarm_class: e.target.checked ? 1 : null }))}
                    style={{ cursor: 'pointer' }} />
                  Alarm
                </label>
                {form.is_alarm && (
                  <select value={form.alarm_class?.toString() ?? '1'}
                    onChange={e => setForm(prev => ({ ...prev, alarm_class: Number(e.target.value) as AlarmClass }))}
                    style={{ background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '4px 8px', fontSize: '12px', outline: 'none' }}>
                    <option value="1">F1</option><option value="2">F2</option><option value="3">F3</option>
                  </select>
                )}
                <select value={form.source_type ?? 'IED'}
                  onChange={e => setForm(prev => ({ ...prev, source_type: e.target.value as SourceType }))}
                  style={{ background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '4px 8px', fontSize: '12px', outline: 'none' }}>
                  <option value="IED">IED</option>
                  <option value="HARDWIRED">Harðvíraður</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <Button variant="ghost" onClick={onClose}>Hætta við</Button>
                <Button onClick={onSave} disabled={!form.code?.trim() || !form.name_is?.trim() || newSaving}>
                  {newSaving ? 'Vista...' : isEdit ? 'Vista breytingar' : 'Vista í safn'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
```

- [ ] **Skref 3: Tengja `SignalsTab` í `LibraryView`**

Uppfæra `LibraryView` fallið til að nota `SignalsTab`:

```tsx
export function LibraryView() {
  const [tab, setTab] = useState<LibTab>('signals');

  const tabStyle = (t: LibTab): React.CSSProperties => ({
    background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer',
    fontSize: '13px', fontWeight: tab === t ? 600 : 400,
    color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    marginBottom: '-1px',
  });

  return (
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
        Library
      </h1>
      <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--line)', marginBottom: 'var(--space-6)' }}>
        <button type="button" style={tabStyle('signals')} onClick={() => setTab('signals')}>Merkjasafn</button>
        <button type="button" style={tabStyle('states')} onClick={() => setTab('states')}>Stöður</button>
        <button type="button" style={tabStyle('templates')} onClick={() => setTab('templates')}>Sniðmát</button>
      </div>

      {tab === 'signals' && <SignalsTab />}
      {tab === 'states' && <p style={{ color: 'var(--muted)' }}>Stöður — kemur í Task 3</p>}
      {tab === 'templates' && <p style={{ color: 'var(--muted)' }}>Sniðmát — kemur í Task 4</p>}
    </div>
  );
}
```

- [ ] **Skref 4: TypeScript check**

```bash
cd /Users/teddi/Documents/merkjalisti && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "test\." | grep "error TS"
```

Búast við: engar villur.

- [ ] **Skref 5: Commit**

```bash
cd /Users/teddi/Documents/merkjalisti
git add src/pages/LibraryView.tsx
git commit -m "feat: LibraryView Merkjasafn flipi — global signal library með project picker"
```

---

## Task 3: Stöður flipi — signal states read-only

**Files:**
- Modify: `src/pages/LibraryView.tsx`

### Bakgrunnur

`data/signal_states.json` inniheldur `SignalState[]`. Hver `SignalState` hefur:
- `id: string`
- `type: string | null` — t.d. `"SPS"`, `"DPS"`, `"MV"` 
- `states: Partial<Record<'00'|'01'|'10'|'11', { key, is, en }>>` — textar per stöðukóða

Við sýnum þetta sem read-only töflu. IS/EN toggle eins og í Merkjasafn.

- [ ] **Skref 1: Búa til `StatesTab` component**

Bæta við þessum component Á undan `LibraryView` fallinu:

```tsx
function StatesTab() {
  const { api } = useApi();
  const [states, setStates] = useState<import('../types').SignalState[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'is' | 'en'>('is');

  useEffect(() => {
    api.readJson<import('../types').SignalState[]>('data/signal_states.json')
      .then(({ data }) => setStates(data))
      .finally(() => setLoading(false));
  }, [api]);

  const cell: React.CSSProperties = {
    padding: '5px 8px', borderBottom: '1px solid var(--line-muted)', fontSize: '12px', verticalAlign: 'top',
  };
  const head: React.CSSProperties = {
    ...cell, fontWeight: 600, color: 'var(--text-secondary)',
    background: 'var(--surface-alt)', whiteSpace: 'nowrap',
    position: 'sticky', top: 0, zIndex: 1,
  };

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{states.length} stöðuflokkar</span>
        <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
          {(['is', 'en'] as const).map(l => (
            <button key={l} type="button" onClick={() => setLang(l)}
              style={{ padding: '2px 10px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: lang === l ? 'var(--accent)' : 'transparent',
                color: lang === l ? '#fff' : 'var(--text-secondary)' }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Tegund', '00', '01', '10', '11'].map(h => (
                <th key={h} style={head}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {states.length === 0 && (
              <tr><td colSpan={5} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-8)' }}>Engar stöður</td></tr>
            )}
            {states.map((s, i) => (
              <tr key={s.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                <td style={{ ...cell, fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)' }}>
                  {s.type ?? '—'}
                </td>
                {(['00', '01', '10', '11'] as const).map(k => {
                  const entry = s.states[k];
                  const text = entry ? (lang === 'is' ? entry.is : entry.en) : null;
                  return (
                    <td key={k} style={{ ...cell, color: text ? 'var(--text)' : 'var(--muted)', minWidth: '120px' }}>
                      {text ?? '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Skref 2: Tengja `StatesTab` í `LibraryView`**

Uppfæra `{tab === 'states' && ...}` línuna í `LibraryView`:

```tsx
{tab === 'states' && <StatesTab />}
```

- [ ] **Skref 3: TypeScript check**

```bash
cd /Users/teddi/Documents/merkjalisti && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "test\." | grep "error TS"
```

Búast við: engar villur.

- [ ] **Skref 4: Commit**

```bash
cd /Users/teddi/Documents/merkjalisti
git add src/pages/LibraryView.tsx
git commit -m "feat: LibraryView Stöður flipi — signal states read-only tafla"
```

---

## Task 4: Sniðmát flipi — templates read-only

**Files:**
- Modify: `src/pages/LibraryView.tsx`

### Bakgrunnur

Tveir undirflipar:

**Tækjasniðmát** — `data/equipment_templates.json` er `EquipmentTemplate[]`:
```typescript
interface EquipmentTemplate {
  id: string; name: string; category: EquipmentCategory;
  manufacturer?: string; model?: string; description?: string;
}
```

**Reitsniðmát** — `data/bay_templates/*.json`, hvert JSON er `BayTemplate`:
```typescript
interface BayTemplate {
  template_name: string; station: string; voltage_level: string;
  bay_name: string; display_id: string; equipment_codes: string[];
  signals: Omit<BaySignal, 'phase_added'>[];
}
```

`listBayTemplates(api): Promise<BayTemplate[]>` er þegar til í `bayService.ts`.

Við sýnum bara töflur — engar breytingar (read-only, YAGNI).

- [ ] **Skref 1: Bæta við `listBayTemplates` í imports**

Uppfæra bayService import efst í skránni:

```tsx
import { listBays, loadBay, saveBay, listBayTemplates } from '../services/bayService';
```

Bæta líka við `EquipmentTemplate` og `BayTemplate` í type imports:

```tsx
import type { SignalLibraryEntry, BaySignal, Bay, Project, AlarmClass, SourceType, EquipmentTemplate, BayTemplate } from '../types';
```

- [ ] **Skref 2: Búa til `TemplatesTab` component**

Bæta við þessum component FYRIR `LibraryView` fallið:

```tsx
function TemplatesTab() {
  const { api } = useApi();
  const [eqTemplates, setEqTemplates] = useState<EquipmentTemplate[]>([]);
  const [bayTemplates, setBayTemplates] = useState<BayTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'equipment' | 'bay'>('equipment');

  useEffect(() => {
    Promise.all([
      api.readJson<EquipmentTemplate[]>('data/equipment_templates.json').catch(() => ({ data: [] as EquipmentTemplate[], sha: '' })),
      listBayTemplates(api),
    ]).then(([{ data: eq }, bay]) => {
      setEqTemplates(eq);
      setBayTemplates(bay);
    }).finally(() => setLoading(false));
  }, [api]);

  const cell: React.CSSProperties = {
    padding: '5px 8px', borderBottom: '1px solid var(--line-muted)', fontSize: '12px',
  };
  const head: React.CSSProperties = {
    ...cell, fontWeight: 600, color: 'var(--text-secondary)',
    background: 'var(--surface-alt)', whiteSpace: 'nowrap',
  };

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {([['equipment', `Tækjasniðmát (${eqTemplates.length})`], ['bay', `Reitsniðmát (${bayTemplates.length})`]] as ['equipment' | 'bay', string][]).map(([id, label]) => (
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
        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Nafn', 'Flokkur', 'Framleiðandi', 'Líkan', 'Lýsing'].map(h => <th key={h} style={head}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {eqTemplates.length === 0 && (
                <tr><td colSpan={5} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-8)' }}>Engin tækjasniðmát</td></tr>
              )}
              {eqTemplates.map((t, i) => (
                <tr key={t.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                  <td style={{ ...cell, fontWeight: 600 }}>{t.name}</td>
                  <td style={{ ...cell, color: 'var(--muted)', fontSize: '11px' }}>{t.category}</td>
                  <td style={{ ...cell }}>{t.manufacturer ?? '—'}</td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px' }}>{t.model ?? '—'}</td>
                  <td style={{ ...cell, color: 'var(--muted)' }}>{t.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'bay' && (
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
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent)' }}>{t.display_id}</td>
                  <td style={{ ...cell, color: 'var(--muted)' }}>{t.signals.length}</td>
                  <td style={{ ...cell, color: 'var(--muted)' }}>{t.equipment_codes.length > 0 ? t.equipment_codes.join(', ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Skref 3: Tengja `TemplatesTab` í `LibraryView`**

Uppfæra `{tab === 'templates' && ...}` línuna:

```tsx
{tab === 'templates' && <TemplatesTab />}
```

- [ ] **Skref 4: TypeScript check**

```bash
cd /Users/teddi/Documents/merkjalisti && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v "test\." | grep "error TS"
```

Búast við: engar villur.

- [ ] **Skref 5: Commit**

```bash
cd /Users/teddi/Documents/merkjalisti
git add src/pages/LibraryView.tsx
git commit -m "feat: LibraryView Sniðmát flipi — tækja- og reitsniðmát"
```

---

## Sjálfsyfirferð

**1. Spec coverage:**
- ✅ `/library` route — Task 1
- ✅ AppShell nav uppfærð — Task 1
- ✅ Merkjasafn flipi með search, IS/EN, select, bulk add, new, edit — Task 2
- ✅ Project picker í "bæta við í reit" glugga — Task 2
- ✅ Stöður flipi read-only með IS/EN — Task 3
- ✅ Sniðmát flipi — tækjasniðmát og reitsniðmát — Task 4

**2. Placeholder scan:** Engar.

**3. Type consistency:**
- `SignalsTab` notar `SignalLibraryEntry`, `BaySignal`, `Bay`, `Project` — allt imported rétt
- `StatesTab` notar `SignalState` via inline import — rétt
- `TemplatesTab` notar `EquipmentTemplate`, `BayTemplate` — bætt í type imports í Task 4, step 1
- `listBayTemplates` er þegar exported frá `bayService.ts` ✅
- `listProjects` er þegar exported frá `projectService.ts` ✅
- `uuid()` er defined í `LibraryView.tsx` — notað í `SignalsTab` ✅
