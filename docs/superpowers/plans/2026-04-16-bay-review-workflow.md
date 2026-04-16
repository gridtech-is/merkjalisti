# Bay Review Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bæta við DRAFT → IN_REVIEW → LOCKED verkflæði á reit-stigi, með per-merki athugasemdum yfirferðarmanns og sjálfvirkri afturköllunar-læsingu.

**Architecture:** `Bay` fær `status` og `review` reiti; `BaySignal` fær `review_flagged` og `review_comment`. BayView læsir breytingartakka í IN_REVIEW og sýnir samþykkja/hafna takkana. SignalTable fær valfrjálsan `reviewMode` prop sem kveikir á flagging dálki. ProjectView sýnir stöðu-merki per reit og bulk-send takka.

**Tech Stack:** React 18 + TypeScript + Vite, GitHub sem JSON gagnagrunnur.

---

## Skráarbygging

| Skrá | Breyting |
|------|----------|
| `src/types.ts` | Bæta við `BayStatus`, `BayReview`; uppfæra `Bay` og `BaySignal` |
| `src/services/bayService.ts` | Migration í `loadBay`+`listBays`; uppfæra `createBay`; bæta við `sendBayForReview`, `approveBay`, `rejectBay` |
| `src/pages/BayView.tsx` | Þrír hamur, status badge, review takkar, LOCKED→DRAFT auto-revert |
| `src/components/SignalTable.tsx` | `reviewMode` prop, flag dálkur, rauðar línur, comment popup |
| `src/pages/ProjectView.tsx` | Status merki í reitarlístu, bulk-send og per-reit takkar |

---

## Task 1: Gagnalíkan — types.ts + bayService.ts

**Files:**
- Modify: `src/types.ts`
- Modify: `src/services/bayService.ts`

### Bakgrunnur

`Bay` er geymt í `projects/{projectId}/bays/{bayId}.json`. `loadBay` les eina skrá, `listBays` les allar skrár í möppunni. `createBay` búar til nýja Bay. `saveBay` vistar breytingar.

`BaySignal` er innfellt fylki í `Bay.signals`. Þegar migration þarf, er hún gerð inline á lestrartíma — ekki sérstök migration-skrá.

- [ ] **Skref 1: Uppfæra `src/types.ts` — bæta við BayStatus og BayReview**

Finndu línuna `// ─── Bay ───` og bættu við rétt á undan `export interface Bay`:

```typescript
// ─── Bay review ────────────────────────────────────────────────────────────

export type BayStatus = 'DRAFT' | 'IN_REVIEW' | 'LOCKED';

export interface BayReview {
  sent_by: string;
  sent_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  status: 'OPEN' | 'APPROVED' | 'REJECTED';
  comment: string | null;
}
```

- [ ] **Skref 2: Uppfæra `Bay` interface í `src/types.ts`**

Breyta `Bay` interface til að bæta við `status` og `review`:

```typescript
export interface Bay {
  id: string;
  station: string;
  voltage_level: string;
  bay_name: string;
  display_id: string;
  equipment_ids: string[];
  signals: BaySignal[];
  status: BayStatus;
  review: BayReview | null;
}
```

- [ ] **Skref 3: Uppfæra `BaySignal` interface í `src/types.ts`**

Bæta við tveimur nýjum línum neðst í `BaySignal` — rétt á undan lokandi `}`:

```typescript
  review_flagged: boolean;
  review_comment: string | null;
```

- [ ] **Skref 4: Uppfæra `createBay` í `src/services/bayService.ts`**

Bæta við `status: 'DRAFT', review: null` og `review_flagged: false, review_comment: null` þar sem Bay og BaySignal eru búin til:

```typescript
export async function createBay(
  api: GitHubApi,
  projectId: string,
  station: string,
  voltageLevel: string,
  bayName: string,
  signals: BaySignal[],
  createdBy: string
): Promise<BayFile> {
  const id = uuid();
  const bay: Bay = {
    id,
    station,
    voltage_level: voltageLevel,
    bay_name: bayName,
    display_id: `${station}${bayName}`,
    equipment_ids: [],
    signals: signals.map(s => ({
      review_flagged: false,
      review_comment: null,
      ...s,
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

- [ ] **Skref 5: Bæta við migration í `loadBay` í `src/services/bayService.ts`**

Þegar `Bay` er lesinn án `status`/`review` → sjálfgefnar gildi. Sama fyrir `BaySignal`:

```typescript
export async function loadBay(api: GitHubApi, projectId: string, bayId: string): Promise<BayFile> {
  const path = `projects/${projectId}/bays/${bayId}.json`;
  const { data, sha } = await api.readJson<Bay>(path);
  const bay: Bay = {
    status: 'DRAFT',
    review: null,
    ...data,
    signals: data.signals.map(s => ({
      review_flagged: false,
      review_comment: null,
      ...s,
    })),
  };
  return { bay, sha };
}
```

- [ ] **Skref 6: Bæta við migration í `listBays` í `src/services/bayService.ts`**

```typescript
export async function listBays(api: GitHubApi, projectId: string): Promise<Bay[]> {
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
      return {
        status: 'DRAFT' as const,
        review: null,
        ...data,
        signals: data.signals.map(s => ({
          review_flagged: false,
          review_comment: null,
          ...s,
        })),
      };
    });
}
```

- [ ] **Skref 7: Bæta við `sendBayForReview` í `src/services/bayService.ts`**

Bæta við import á `appendChange` efst í skránni:

```typescript
import { appendChange } from './changelogService';
```

Bæta við neðst í skránni (á eftir `saveBay`):

```typescript
export async function sendBayForReview(
  api: GitHubApi,
  projectId: string,
  bayFile: BayFile,
  sentBy: string
): Promise<BayFile> {
  const now = new Date().toISOString();
  const updated: Bay = {
    ...bayFile.bay,
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
  const path = `projects/${projectId}/bays/${bayFile.bay.id}.json`;
  const msg = `[REVIEW] Sent í yfirferð: ${bayFile.bay.display_id}`;
  const sha = await api.writeJson(path, updated, bayFile.sha, msg);
  appendChange(api, projectId, {
    user: sentBy, phase: 'REVIEW', type: 'REVIEW_ADDED',
    target_id: bayFile.bay.id, target_type: 'bay',
    field: null, old_value: 'DRAFT', new_value: 'IN_REVIEW',
    comment: `Reitur sendur í yfirferð: ${bayFile.bay.display_id}`,
  });
  return { bay: updated, sha };
}
```

- [ ] **Skref 8: Bæta við `approveBay` í `src/services/bayService.ts`**

```typescript
export async function approveBay(
  api: GitHubApi,
  projectId: string,
  bayFile: BayFile,
  reviewedBy: string,
  comment: string | null
): Promise<BayFile> {
  const now = new Date().toISOString();
  const updated: Bay = {
    ...bayFile.bay,
    status: 'LOCKED',
    review: {
      ...(bayFile.bay.review ?? { sent_by: reviewedBy, sent_at: now }),
      reviewed_by: reviewedBy,
      reviewed_at: now,
      status: 'APPROVED',
      comment,
    },
  };
  const path = `projects/${projectId}/bays/${bayFile.bay.id}.json`;
  const msg = `[REVIEW] Samþykkt: ${bayFile.bay.display_id}`;
  const sha = await api.writeJson(path, updated, bayFile.sha, msg);
  appendChange(api, projectId, {
    user: reviewedBy, phase: 'REVIEW', type: 'REVIEW_ADDED',
    target_id: bayFile.bay.id, target_type: 'bay',
    field: null, old_value: 'IN_REVIEW', new_value: 'LOCKED',
    comment: `Reitur samþykktur: ${bayFile.bay.display_id}`,
  });
  return { bay: updated, sha };
}
```

- [ ] **Skref 9: Bæta við `rejectBay` í `src/services/bayService.ts`**

```typescript
export async function rejectBay(
  api: GitHubApi,
  projectId: string,
  bayFile: BayFile,
  reviewedBy: string,
  comment: string
): Promise<BayFile> {
  const now = new Date().toISOString();
  const updated: Bay = {
    ...bayFile.bay,
    status: 'DRAFT',
    review: {
      ...(bayFile.bay.review ?? { sent_by: reviewedBy, sent_at: now }),
      reviewed_by: reviewedBy,
      reviewed_at: now,
      status: 'REJECTED',
      comment,
    },
  };
  const path = `projects/${projectId}/bays/${bayFile.bay.id}.json`;
  const msg = `[REVIEW] Hafnað: ${bayFile.bay.display_id}`;
  const sha = await api.writeJson(path, updated, bayFile.sha, msg);
  appendChange(api, projectId, {
    user: reviewedBy, phase: 'REVIEW', type: 'REVIEW_ADDED',
    target_id: bayFile.bay.id, target_type: 'bay',
    field: null, old_value: 'IN_REVIEW', new_value: 'DRAFT',
    comment: `Reitur hafnaður: ${bayFile.bay.display_id}. ${comment}`,
  });
  return { bay: updated, sha };
}
```

- [ ] **Skref 10: TypeScript check**

```bash
cd /Users/teddi/Documents/merkjalisti && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "types\.ts|bayService" | grep -v test
```

Búast við: engar línur (engar villur í þessum skrám).

- [ ] **Skref 11: Commit**

```bash
cd /Users/teddi/Documents/merkjalisti
git add src/types.ts src/services/bayService.ts
git commit -m "feat: BayStatus/BayReview gagnalíkan + review service functions"
```

---

## Task 2: BayView — yfirferðarviðmót

**Files:**
- Modify: `src/pages/BayView.tsx`

### Bakgrunnur

BayView er í `/Users/teddi/Documents/merkjalisti/src/pages/BayView.tsx`. Það notar `bayFile` state (BayFile = `{ bay: Bay; sha: string }`). `commitChanges` kallar `saveBay` og hreinsar `isDirty`. `useAutoCommit` kallar `commitChanges` þegar `isDirty` er satt.

Þrír hamur eftir `bay.status`:
- **DRAFT**: allt virkt + "Senda í yfirferð" takki
- **IN_REVIEW**: breytingartakkar óvirkir + "Samþykkja"/"Hafna" takkar
- **LOCKED**: allt virkt + grænt merki, en við `commitChanges` → auto-revert til DRAFT + hreinsa flags

- [ ] **Skref 1: Bæta við imports í `BayView.tsx`**

Breyta import línu bayService:

```typescript
import { loadBay, saveBay, saveBayTemplate, sendBayForReview, approveBay, rejectBay, type BayFile } from '../services/bayService';
```

- [ ] **Skref 2: Bæta við `reviewSending` state í BayView**

Rétt eftir `const [savingTemplate, setSavingTemplate] = useState(false);`:

```typescript
const [reviewSending, setReviewSending] = useState(false);
```

- [ ] **Skref 3: Uppfæra `commitChanges` til að meðhöndla LOCKED → DRAFT**

Breyta `commitChanges` fallinu:

```typescript
const commitChanges = async () => {
  const current = bayFileRef.current;
  if (!current || !projectId) return;

  let bayToSave = current;
  if (current.bay.status === 'LOCKED') {
    const clearedBay: Bay = {
      ...current.bay,
      status: 'DRAFT',
      signals: current.bay.signals.map(s => ({
        ...s,
        review_flagged: false,
        review_comment: null,
      })),
    };
    bayToSave = { ...current, bay: clearedBay };
    setBayFile(bayToSave);
    appendChange(api, projectId, {
      user: userName, phase: 'DESIGN', type: 'PHASE_CHANGED',
      target_id: current.bay.id, target_type: 'bay',
      field: null, old_value: 'LOCKED', new_value: 'DRAFT',
      comment: `Reitur opnaður aftur eftir læsingu: ${current.bay.display_id}`,
    });
  }

  const updated = await saveBay(api, projectId, bayToSave, bayToSave.bay.status);
  setBayFile(updated);
  setIsDirty(false);
  setLastSaved(new Date());
};
```

Þetta krefst `import type { Bay } from '../types'` — bæta við `Bay` í type import línuna:

```typescript
import type { BaySignal, Bay, Equipment, SignalLibraryEntry, SignalState } from '../types';
```

- [ ] **Skref 4: Bæta við `handleSendForReview` í BayView**

Rétt á eftir `handleSaveTemplate` fallinu:

```typescript
const handleSendForReview = async () => {
  if (!bayFile || !projectId) return;
  if (!confirm(`Senda "${bayFile.bay.display_id}" í yfirferð? Reiturinn verður læstur þar til yfirferð lýkur.`)) return;
  setReviewSending(true);
  try {
    const updated = await sendBayForReview(api, projectId, bayFile, userName);
    setBayFile(updated);
    setIsDirty(false);
  } catch {
    alert('Villa við að senda í yfirferð. Reyndu aftur.');
  } finally {
    setReviewSending(false);
  }
};

const handleApprove = async () => {
  if (!bayFile || !projectId) return;
  const comment = prompt('Athugasemd (valkvæmt):') ?? null;
  setReviewSending(true);
  try {
    const updated = await approveBay(api, projectId, bayFile, userName, comment);
    setBayFile(updated);
  } catch {
    alert('Villa við samþykki. Reyndu aftur.');
  } finally {
    setReviewSending(false);
  }
};

const handleReject = async () => {
  if (!bayFile || !projectId) return;
  const comment = prompt('Ástæða hafnunar (nauðsynlegt):');
  if (!comment?.trim()) return;
  setReviewSending(true);
  try {
    const updated = await rejectBay(api, projectId, bayFile, userName, comment.trim());
    setBayFile(updated);
  } catch {
    alert('Villa við höfnun. Reyndu aftur.');
  } finally {
    setReviewSending(false);
  }
};
```

- [ ] **Skref 5: Uppfæra header JSX — status badge og takkar**

Núverandi header `<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...}}>` — breyta takka-div hlutann. Setja inn þessa kóða (yfirskrifa takkasvæðið):

```tsx
const { bay } = bayFile;
const isInReview = bay.status === 'IN_REVIEW';
const isLocked = bay.status === 'LOCKED';
const isDraft = bay.status === 'DRAFT';

// Status badge
const statusBadge = isDraft ? null : (
  <span style={{
    fontSize: '11px', fontWeight: 700, padding: '3px 8px',
    borderRadius: 'var(--radius-sm)',
    background: isInReview ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'color-mix(in srgb, var(--success) 20%, transparent)',
    color: isInReview ? 'var(--accent)' : 'var(--success)',
    border: `1px solid ${isInReview ? 'var(--accent)' : 'var(--success)'}`,
  }}>
    {isInReview
      ? `Í YFIRFERÐ — sent af ${bay.review?.sent_by ?? ''} ${bay.review?.sent_at ? new Date(bay.review.sent_at).toLocaleDateString('is-IS') : ''}`
      : `LÆST — samþykkt af ${bay.review?.reviewed_by ?? ''} ${bay.review?.reviewed_at ? new Date(bay.review.reviewed_at).toLocaleDateString('is-IS') : ''}`
    }
  </span>
);
```

Breyta takkadiv-inum (línur ~176-192 í núverandi skrá) yfir í:

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
  {statusBadge}
  {isDirty && <span style={{ fontSize: '12px', color: 'var(--warn)' }}>● Óvistað</span>}
  {lastSaved && !isDirty && (
    <span style={{ fontSize: '12px', color: 'var(--success)' }}>
      ✓ Vistað {lastSaved.toLocaleTimeString('is-IS')}
    </span>
  )}

  {/* DRAFT takkar */}
  {isDraft && (
    <>
      <Button size="sm" variant="ghost" onClick={handleSaveTemplate} disabled={savingTemplate}>⊕ Sniðmát</Button>
      <Button size="sm" variant="ghost" onClick={() => exportBayToExcel(bay)}>↓ Excel</Button>
      <Button size="sm" variant="ghost" onClick={() => setShowImport(true)}>↑ Innflutningur</Button>
      <Button size="sm" onClick={() => setShowPicker(true)}>+ Bæta við merki</Button>
      <Button size="sm" onClick={commitChanges} disabled={!isDirty}>Vista núna</Button>
      <Button size="sm" variant="ghost" onClick={() => setTestPhase('FAT')}>FAT</Button>
      <Button size="sm" variant="ghost" onClick={() => setTestPhase('SAT')}>SAT</Button>
      <Button size="sm" variant="ghost" onClick={handleSendForReview} disabled={reviewSending}>→ Senda í yfirferð</Button>
    </>
  )}

  {/* IN_REVIEW takkar — aðeins yfirferðarmaður */}
  {isInReview && (
    <>
      <Button size="sm" onClick={() => setShowPicker(true)}>+ Bæta við merki</Button>
      <Button size="sm" variant="ghost" onClick={() => exportBayToExcel(bay)}>↓ Excel</Button>
      <Button size="sm" variant="ghost" onClick={handleReject} disabled={reviewSending} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>✕ Hafna</Button>
      <Button size="sm" onClick={handleApprove} disabled={reviewSending}>✓ Samþykkja</Button>
    </>
  )}

  {/* LOCKED takkar — sama og DRAFT en með læst merki */}
  {isLocked && (
    <>
      <Button size="sm" variant="ghost" onClick={handleSaveTemplate} disabled={savingTemplate}>⊕ Sniðmát</Button>
      <Button size="sm" variant="ghost" onClick={() => exportBayToExcel(bay)}>↓ Excel</Button>
      <Button size="sm" variant="ghost" onClick={() => setShowImport(true)}>↑ Innflutningur</Button>
      <Button size="sm" onClick={() => setShowPicker(true)}>+ Bæta við merki</Button>
      <Button size="sm" onClick={commitChanges} disabled={!isDirty}>Vista núna</Button>
      <Button size="sm" variant="ghost" onClick={() => setTestPhase('FAT')}>FAT</Button>
      <Button size="sm" variant="ghost" onClick={() => setTestPhase('SAT')}>SAT</Button>
    </>
  )}
</div>
```

Einnig þarf að fjarlægja gömlu takkarnir (línur ~176-192) og setja þessa í staðinn.

- [ ] **Skref 6: Bæta við `reviewMode` prop á SignalTable**

Breyta `<SignalTable ...>` kallinu til að senda `reviewMode`:

```tsx
<SignalTable
  signals={bay.signals}
  equipment={allEquipment}
  library={signalLibrary}
  states={signalStates}
  bayDisplayId={bay.display_id}
  reviewMode={isInReview || (bay.signals.some(s => s.review_flagged))}
  onUpdate={handleUpdate}
  onDelete={handleDelete}
/>
```

- [ ] **Skref 7: TypeScript check**

```bash
cd /Users/teddi/Documents/merkjalisti && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "BayView" | grep -v test
```

Búast við: engar villur (nema mögulega `reviewMode` prop sem er ekki enn til í SignalTable — þær koma í Task 3).

- [ ] **Skref 8: Commit**

```bash
cd /Users/teddi/Documents/merkjalisti
git add src/pages/BayView.tsx
git commit -m "feat: BayView review mode — DRAFT/IN_REVIEW/LOCKED hamur"
```

---

## Task 3: SignalTable — flagging dálkur

**Files:**
- Modify: `src/components/SignalTable.tsx`

### Bakgrunnur

SignalTable er í `/Users/teddi/Documents/merkjalisti/src/components/SignalTable.tsx`. Props interface er:

```typescript
interface Props {
  signals: BaySignal[];
  equipment: Equipment[];
  library?: SignalLibraryEntry[];
  states?: SignalState[];
  bayDisplayId?: string;
  onUpdate: (signalId: string, patch: Partial<BaySignal>) => void;
  onDelete: (signalId: string) => void;
}
```

Við bætum við `reviewMode?: boolean`. Þegar `reviewMode` er satt:
- Nýr dálkur lengst til hægri: "💬"
- Línur með `review_flagged === true` fá rauðan bakgrunn
- Í IN_REVIEW: "Flagga" takki per lína → opnar inline textareit → vistar review_flagged + review_comment
- Í DRAFT með flaggaðar línur: 💬 tákn → popup með athugasemdar texta + "Hreinsa" takki

- [ ] **Skref 1: Bæta við `reviewMode` í Props interface**

```typescript
interface Props {
  signals: BaySignal[];
  equipment: Equipment[];
  library?: SignalLibraryEntry[];
  states?: SignalState[];
  bayDisplayId?: string;
  reviewMode?: boolean;
  onUpdate: (signalId: string, patch: Partial<BaySignal>) => void;
  onDelete: (signalId: string) => void;
}
```

- [ ] **Skref 2: Bæta við `reviewMode` í function signature og `flagging` state**

Breyta function declaration:

```typescript
export function SignalTable({ signals, equipment, library = [], states = [], bayDisplayId = '', reviewMode = false, onUpdate, onDelete }: Props) {
```

Bæta við state rétt eftir fyrstu `useState` kall í SignalTable (sem er `const [langIs, setLangIs] = useState(true);` eða svipað — skoðaðu skrána):

```typescript
const [flaggingId, setFlaggingId] = useState<string | null>(null);
const [flagComment, setFlagComment] = useState('');
const [popupId, setPopupId] = useState<string | null>(null);
```

- [ ] **Skref 3: Bæta við "💬" dálkhaus í header röðina**

Finndu `<th>` lista í header röðinni. Bæta við síðasta `<th>` ef `reviewMode`:

```tsx
{reviewMode && <th style={head}></th>}
```

- [ ] **Skref 4: Bæta við flag dálk í hverja merki-röð**

Í hverri `<tr>` fyrir merki, bæta við `<td>` á eftir öllum öðrum dálkum, ef `reviewMode`. Settu þetta rétt á undan lokandi `</tr>`:

```tsx
{reviewMode && (
  <td style={{ ...cell, width: '80px', position: 'relative' }}>
    {sig.review_flagged ? (
      // Flaggað merki — sýna 💬 með popup
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setPopupId(popupId === sig.id ? null : sig.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}
          title={sig.review_comment ?? ''}
        >
          💬
        </button>
        {popupId === sig.id && (
          <div style={{
            position: 'absolute', right: 0, top: '100%', zIndex: 10,
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius)', padding: 'var(--space-3)',
            minWidth: '200px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            fontSize: '12px',
          }}>
            <div style={{ color: 'var(--text)', marginBottom: 'var(--space-2)' }}>{sig.review_comment}</div>
            <button
              type="button"
              onClick={() => {
                onUpdate(sig.id, { review_flagged: false, review_comment: null });
                setPopupId(null);
              }}
              style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', cursor: 'pointer' }}
            >
              Hreinsa
            </button>
          </div>
        )}
      </div>
    ) : flaggingId === sig.id ? (
      // Flaggandi mode — inline textareit
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <input
          autoFocus
          value={flagComment}
          onChange={e => setFlagComment(e.target.value)}
          placeholder="Athugasemd..."
          style={{ ...eInput, border: '1px solid var(--accent)', width: '120px' }}
          onKeyDown={e => {
            if (e.key === 'Enter' && flagComment.trim()) {
              onUpdate(sig.id, { review_flagged: true, review_comment: flagComment.trim() });
              setFlaggingId(null);
              setFlagComment('');
            }
            if (e.key === 'Escape') { setFlaggingId(null); setFlagComment(''); }
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (flagComment.trim()) {
              onUpdate(sig.id, { review_flagged: true, review_comment: flagComment.trim() });
            }
            setFlaggingId(null);
            setFlagComment('');
          }}
          style={{ fontSize: '11px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '2px 6px', cursor: 'pointer' }}
        >✓</button>
      </div>
    ) : (
      // Ekki flaggað — "Flagga" takki
      <button
        type="button"
        onClick={() => { setFlaggingId(sig.id); setFlagComment(''); }}
        style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', cursor: 'pointer' }}
      >
        💬
      </button>
    )}
  </td>
)}
```

- [ ] **Skref 5: Bæta við rauðan bakgrunn á flaggaðar línur**

Í `<tr>` fyrir hvert merki, bæta við `background` style:

```tsx
<tr style={{ background: sig.review_flagged ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : 'transparent' }}>
```

Ef `<tr>` hefur þegar `style` prop, sameina þau.

- [ ] **Skref 6: TypeScript check**

```bash
cd /Users/teddi/Documents/merkjalisti && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "SignalTable\|BayView" | grep -v test
```

Búast við: engar villur.

- [ ] **Skref 7: Commit**

```bash
cd /Users/teddi/Documents/merkjalisti
git add src/components/SignalTable.tsx
git commit -m "feat: SignalTable reviewMode — flag dálkur, rauðar línur, comment popup"
```

---

## Task 4: ProjectView — stöðumerki og bulk-send

**Files:**
- Modify: `src/pages/ProjectView.tsx`

### Bakgrunnur

ProjectView er í `/Users/teddi/Documents/merkjalisti/src/pages/ProjectView.tsx`. `bays` state er `Bay[]` — `listBays` skilar þeim núna með `status` reit (eftir migration í Task 1). Bay kortin eru í `tab === 'bays'` hlutanum.

Við þurfum:
1. Status merki á hvert bay kort
2. "→ Yfirferð" takki per DRAFT bay
3. "Senda alla í yfirferð" bulk takki
4. "Allt læst ✓" merki ef allir reitir eru LOCKED

Þar sem `listBays` skilar `Bay[]` (án SHA) þurfum við sérstaka `sendBay` fallað til að senda í yfirferð frá ProjectView — við þurfum að lesa `sha` fyrst. Við notum nýtt helper fall `sendBayForReviewById`.

- [ ] **Skref 1: Bæta við imports í ProjectView**

Bæta við `loadBay`, `sendBayForReview` í import:

```typescript
import { loadProject, saveProjectPhase } from '../services/projectService';
import { listBays, loadBay, sendBayForReview } from '../services/bayService';
```

- [ ] **Skref 2: Bæta við `sendingReview` state**

Rétt eftir `const [saving, setSaving] = useState(false);`:

```typescript
const [sendingReview, setSendingReview] = useState(false);
```

- [ ] **Skref 3: Bæta við `handleSendBayForReview` fall**

Rétt á undan `return (` í ProjectView:

```typescript
const handleSendBayForReview = async (bayId: string) => {
  if (!projectId) return;
  setSendingReview(true);
  try {
    const bayFile = await loadBay(api, projectId, bayId);
    await sendBayForReview(api, projectId, bayFile, userName);
    // Refresh bay list
    const updated = await listBays(api, projectId);
    setBays(updated);
  } catch {
    alert('Villa við að senda reit í yfirferð.');
  } finally {
    setSendingReview(false);
  }
};

const handleSendAllForReview = async () => {
  const draftBays = bays.filter(b => b.status === 'DRAFT');
  if (draftBays.length === 0) return;
  if (!confirm(`Senda ${draftBays.length} reiti í yfirferð?`)) return;
  if (!projectId) return;
  setSendingReview(true);
  try {
    for (const bay of draftBays) {
      const bayFile = await loadBay(api, projectId, bay.id);
      await sendBayForReview(api, projectId, bayFile, userName);
    }
    const updated = await listBays(api, projectId);
    setBays(updated);
  } catch {
    alert('Villa við að senda reiti í yfirferð.');
  } finally {
    setSendingReview(false);
  }
};
```

- [ ] **Skref 4: Uppfæra reitir-header með bulk-send takka**

Finndu þessa línu í ProjectView:

```tsx
<Button variant="ghost" size="sm" onClick={() => exportAllBaysToExcel(bays, project?.name ?? 'verkefni')}>↓ Excel (allt)</Button>
```

Bæta við "Senda alla í yfirferð" og "Allt læst" á undan þessum takka:

```tsx
{bays.every(b => b.status === 'LOCKED') && bays.length > 0 && (
  <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>✓ Allt læst</span>
)}
{bays.some(b => b.status === 'DRAFT') && (
  <Button variant="ghost" size="sm" onClick={handleSendAllForReview} disabled={sendingReview}>
    → Senda alla í yfirferð
  </Button>
)}
<Button variant="ghost" size="sm" onClick={() => exportAllBaysToExcel(bays, project?.name ?? 'verkefni')}>↓ Excel (allt)</Button>
```

- [ ] **Skref 5: Uppfæra bay kort með status merki og per-reit takka**

Finndu bay kortið í `bays.map(bay => ...)`. Breyta innihaldi kortsins:

```tsx
{bays.map(bay => {
  const statusColor = bay.status === 'LOCKED' ? 'var(--success)' : bay.status === 'IN_REVIEW' ? 'var(--accent)' : 'var(--warn)';
  const statusLabel = bay.status === 'LOCKED' ? 'LÆST' : bay.status === 'IN_REVIEW' ? 'Í YFIRFERÐ' : 'DRAFT';
  return (
    <Card key={bay.id} padding="var(--space-4) var(--space-5)" style={{ cursor: 'pointer' }}
      onClick={() => navigate(`/projects/${projectId}/bays/${bay.id}`)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{bay.display_id}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {bay.signals.length} merki · {bay.equipment_ids.length} tæki
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }} onClick={e => e.stopPropagation()}>
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 7px',
            borderRadius: 'var(--radius-sm)',
            background: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
            color: statusColor,
            border: `1px solid ${statusColor}`,
          }}>{statusLabel}</span>
          {bay.status === 'DRAFT' && (
            <Button size="sm" variant="ghost" disabled={sendingReview}
              onClick={() => handleSendBayForReview(bay.id)}>
              → Yfirferð
            </Button>
          )}
          <span style={{ color: 'var(--muted)', fontSize: '18px' }}>›</span>
        </div>
      </div>
    </Card>
  );
})}
```

- [ ] **Skref 6: Bæta við `userName` í ProjectView**

ProjectView notar ekki `userName` enn. Bæta við:

```typescript
const { api, userName } = useApi();
```

(Breyta `const { api } = useApi();` í `const { api, userName } = useApi();`)

- [ ] **Skref 7: TypeScript check**

```bash
cd /Users/teddi/Documents/merkjalisti && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "ProjectView" | grep -v test
```

Búast við: engar villur.

- [ ] **Skref 8: Commit**

```bash
cd /Users/teddi/Documents/merkjalisti
git add src/pages/ProjectView.tsx
git commit -m "feat: ProjectView — bay stöðumerki og yfirferðar-takkar"
```

---

## Sjálfsyfirferð

**1. Spec coverage:**
- ✅ BayStatus DRAFT/IN_REVIEW/LOCKED — Task 1
- ✅ Migration inline — Task 1 (loadBay + listBays)
- ✅ sendBayForReview / approveBay / rejectBay — Task 1
- ✅ DRAFT → IN_REVIEW læsing — Task 2 (takkar faldir)
- ✅ IN_REVIEW → LOCKED (samþykkja) — Task 2
- ✅ IN_REVIEW → DRAFT (hafna) — Task 2
- ✅ LOCKED → DRAFT auto-revert við breytingu — Task 2
- ✅ Status badge í header — Task 2
- ✅ Per-merki flagging með athugasemd — Task 3
- ✅ Rauður bakgrunnur á flaggaðar línur — Task 3
- ✅ Comment popup + "Hreinsa" — Task 3
- ✅ Status merki í reitarlístu — Task 4
- ✅ "→ Yfirferð" per reit — Task 4
- ✅ "Senda alla í yfirferð" bulk — Task 4
- ✅ "Allt læst ✓" merki — Task 4
- ✅ appendChange kallað í öllum service föllum — Task 1

**2. Placeholder scan:** Engar.

**3. Type consistency:**
- `BayStatus` skilgreint í Task 1, notað í Task 2, 3, 4 ✅
- `BayReview` skilgreint í Task 1, notað í Task 2 header badge ✅
- `sendBayForReview(api, projectId, bayFile, userName)` — sama signature í Task 1 og Task 2/4 ✅
- `approveBay(api, projectId, bayFile, reviewedBy, comment)` — sama í Task 1 og Task 2 ✅
- `rejectBay(api, projectId, bayFile, reviewedBy, comment)` — sama í Task 1 og Task 2 ✅
- `reviewMode` prop í SignalTable — bætt við í Task 3, notað í Task 2 ✅
