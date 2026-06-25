# SCD merki-innflutningur + uppfærsla liða — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SCD-innflutningur vistar `IedFcda[]` módel per lið (eins og ICD-per-liða), parar við Tech key, uppfærir liði sem eru til og bætir nýjum við — með nýtt/uppfærir merkjum í glugganum.

**Architecture:** Eitt nýtt hreint fall í `iedModelService` flatnar `ScdIed` → `IedFcda[]` með DataSet-auðgun (endurnýtt af `parseModel`). `ImportScdModal` byggir módel per valinn lið, parar IED-nafn við Tech key og skilar færslum upp. `ProjectView` vistar tæki (uppfærð + ný) og módelskrár.

**Tech Stack:** React 18 + TypeScript + Vite + Vitest. DOM-parsing í gegnum `DOMParser` (jsdom í test).

Hönnunarskjal: `docs/superpowers/specs/2026-06-25-scd-merki-innflutningur-design.md`

---

## Task 1: `flattenIedModelWithDataSets` + endurskrifa `parseModel`

**Files:**
- Modify: `src/services/iedModelService.ts`
- Create: `src/services/iedModelService.test.ts`

Núverandi `parseModel` (línur ~39–77) gerir flatten + DataSet-auðgun inline fyrir EITT valið IED. Við drögum auðgunina út í endurnýtanlegt fall sem `ImportScdModal` getur kallað per lið.

- [ ] **Step 1: Skrifa fallandi prófið**

Create `src/services/iedModelService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseScd } from './scdParser';
import { flattenIedModelWithDataSets, parseModel } from './iedModelService';

// STUB1 kemur fyrst og hefur tóman LDevice (0 LDs með LN).
// CTRL1 hefur eitt LD með CSWI.Pos (DPC: stVal ST, ctlVal CO) og DataSet DS1
// sem vísar í Pos/stVal.
const SCD = `<?xml version="1.0"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL">
  <IED name="STUB1"><AccessPoint name="S1"><Server>
    <LDevice inst="LD0"></LDevice>
  </Server></AccessPoint></IED>
  <IED name="CTRL1"><AccessPoint name="S1"><Server>
    <LDevice inst="LD0">
      <LN0 lnClass="LLN0" lnType="LLN0type">
        <DataSet name="DS1">
          <FCDA ldInst="LD0" prefix="" lnClass="CSWI" lnInst="1" doName="Pos" daName="stVal" fc="ST"/>
        </DataSet>
      </LN0>
      <LN prefix="" lnClass="CSWI" inst="1" lnType="CSWItype"/>
    </LDevice>
  </Server></AccessPoint></IED>
  <DataTypeTemplates>
    <LNodeType id="LLN0type" lnClass="LLN0"/>
    <LNodeType id="CSWItype" lnClass="CSWI">
      <DO name="Pos" type="DPCtype"/>
    </LNodeType>
    <DOType id="DPCtype" cdc="DPC">
      <DA name="stVal" fc="ST" bType="Dbpos"/>
      <DA name="ctlVal" fc="CO" bType="BOOLEAN"/>
    </DOType>
  </DataTypeTemplates>
</SCL>`;

describe('flattenIedModelWithDataSets', () => {
  it('flatnar DO/DA og auðgar með DataSet nafni á réttri FCDA', () => {
    const { ieds } = parseScd(SCD);
    const ctrl = ieds.find(i => i.name === 'CTRL1')!;
    const fcda = flattenIedModelWithDataSets(ctrl, SCD);

    const pos = fcda.find(f => f.doName === 'Pos' && f.daName === 'stVal')!;
    expect(pos.dataset).toBe('DS1');

    const ctl = fcda.find(f => f.daName === 'ctlVal');
    expect(ctl).toBeDefined();
    expect(ctl!.dataset).toBeUndefined();
  });
});

describe('parseModel', () => {
  it('velur IED með flest LD og auðgar dataset', () => {
    const { fcda, iedName, error } = parseModel(SCD);
    expect(error).toBeUndefined();
    expect(iedName).toBe('CTRL1');
    expect(fcda.find(f => f.daName === 'stVal')?.dataset).toBe('DS1');
  });
});
```

- [ ] **Step 2: Keyra prófið til að staðfesta að það falli**

Run: `npm test -- iedModelService`
Expected: FAIL — `flattenIedModelWithDataSets is not a function` (eða import-villa).

- [ ] **Step 3: Bæta við fallinu og endurnýta í `parseModel`**

Í `src/services/iedModelService.ts`, bæta nýju falli við á eftir `flattenIedModel` (á eftir línu 28):

```ts
/** Flatnar ScdIed í IedFcda[] og auðgar með DataSet nöfnum úr SCD/ICD textanum. */
export function flattenIedModelWithDataSets(ied: ScdIed, xmlText: string): IedFcda[] {
  const flat = flattenIedModel(ied);
  const dsFcdas = extractDataSets(xmlText, ied.name);
  for (const dsf of dsFcdas) {
    // Match by ldInst + lnClass + lnInst + prefix + doName + fc.
    // daName may be absent in DataSet FCDA (references whole DO).
    for (const f of flat) {
      if (
        f.ldInst === dsf.ldInst &&
        f.lnClass === dsf.lnClass &&
        f.lnInst === dsf.lnInst &&
        f.prefix === dsf.prefix &&
        f.doName === dsf.doName &&
        f.fc === dsf.fc &&
        (!dsf.daName || f.daName === dsf.daName || f.daName.startsWith(dsf.daName + '.'))
      ) {
        f.dataset = dsf.dataset;
      }
    }
  }
  return flat;
}
```

Síðan, í `parseModel`, skipta út blokkinni sem byggir `flat` + auðgar (núverandi línur ~46–68) fyrir eitt kall. Eftir línuna sem velur `ied` (`const ied = ieds.reduce(...)`):

```ts
  const flat = flattenIedModelWithDataSets(ied, xmlText);

  return {
    fcda: flat,
    iedName: ied.name,
    manufacturer: ied.manufacturer,
    typeCode: ied.model,
    configVersion: ied.configVersion,
  };
```

Fjarlægja gömlu `extractDataSets(...)` + tvöföldu lykkjuna úr `parseModel` (hún er nú inni í nýja fallinu). `extractDataSets` import-ið efst í skránni helst (notað í nýja fallinu).

- [ ] **Step 4: Keyra prófið til að staðfesta að það standist**

Run: `npm test -- iedModelService`
Expected: PASS (2 próf).

- [ ] **Step 5: Commit**

```bash
git add src/services/iedModelService.ts src/services/iedModelService.test.ts
git commit -m "feat: flattenIedModelWithDataSets fyrir SCD módel-innflutning"
```

---

## Task 2: `ImportScdModal` — byggja módel, para Tech key, sýna nýtt/uppfærir

**Files:**
- Modify: `src/components/ImportScdModal.tsx`

Glugginn byggir `IedFcda[]` per valinn lið, parar IED-nafn við Tech key tækja sem eru til, sýnir merki per röð og skilar færslum upp í gegnum nýja `onImport` callback.

- [ ] **Step 1: Uppfæra imports og props**

Skipta út import-línunum efst (línur 8–10):

```tsx
import { parseScd, scdStats, type ScdIed } from '../services/scdParser';
import { generateTemplateFromScd } from '../services/signalTemplate';
import { flattenIedModelWithDataSets } from '../services/iedModelService';
import type { Equipment, IedFcda } from '../types';
```

Fjarlægja `uuid()` hjálparfallið (línur 12–17) — ekki lengur notað hér.

Skipta út `Props` interface-inu (línur 19–22):

```tsx
export interface ScdImportEntry {
  ied: ScdIed;
  model: IedFcda[];
  existingId: string | null;   // equipment.id ef Tech key passar, annars null
}

interface Props {
  existingIeds: Equipment[];
  onImport: (entries: ScdImportEntry[]) => Promise<void>;
  onClose: () => void;
}
```

Uppfæra fall-undirskriftina:

```tsx
export function ImportScdModal({ existingIeds, onImport, onClose }: Props) {
```

- [ ] **Step 2: Bæta við `xmlText` og `importing` state + Tech key pörun**

Bæta tveimur state-breytum við hjá hinum (á eftir línu 30, `expanded`):

```tsx
  const [xmlText, setXmlText] = useState('');
  const [importing, setImporting] = useState(false);
```

Í `handleFile`, geyma textann — bæta `setXmlText(text);` við inni í `reader.onload` (á eftir `const text = e.target?.result as string;`).

Bæta pörunarhjálp við á eftir `selectedIeds`/`stats` (núverandi línur 71–72):

```tsx
  const matchExistingId = (iedName: string): string | null =>
    existingIeds.find(e => e.code === iedName)?.id ?? null;
  const selectedNew = selectedIeds.filter(i => matchExistingId(i.name) === null).length;
  const selectedUpd = selectedIeds.length - selectedNew;
```

- [ ] **Step 3: Skipta út `handleAddEquipment` fyrir `handleImport`**

Skipta út öllu `handleAddEquipment` fallinu (núverandi línur 74–88):

```tsx
  const handleImport = async () => {
    setImporting(true);
    try {
      const entries: ScdImportEntry[] = selectedIeds.map(ied => ({
        ied,
        model: flattenIedModelWithDataSets(ied, xmlText),
        existingId: matchExistingId(ied.name),
      }));
      await onImport(entries);
    } finally {
      setImporting(false);
    }
  };
```

`handleExcel` helst óbreytt.

- [ ] **Step 4: Bæta nýtt/uppfærir merki við IED-röðina**

Í nafn-reitnum (núverandi línur 185–187), bæta merkinu við strax á eftir IED-nafn `<span>`-inu:

```tsx
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)' }}>{ied.name}</span>
                        {(() => {
                          const upd = matchExistingId(ied.name) !== null;
                          return (
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                              background: upd ? 'color-mix(in srgb, var(--warn, #f59e0b) 15%, transparent)' : 'color-mix(in srgb, var(--success) 15%, transparent)',
                              color: upd ? 'var(--warn, #f59e0b)' : 'var(--success)',
                            }}>{upd ? 'Uppfærir' : 'Nýtt'}</span>
                          );
                        })()}
                        {ied.desc && <span style={{ color: 'var(--muted)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ied.desc}</span>}
```

(Heldur áfram með núverandi `{ied.lds.length > 0 && ( ... expand takki ... )}` blokk og lokar `</div>` óbreytt.)

- [ ] **Step 5: Uppfæra valyfirlit og aðgerðahnappa**

Í valyfirliti (núverandi línur 221–227), bæta nýtt/uppfærir talningu við. Skipta út `<div style={{ fontSize: '12px', ... }}>` blokkinni fyrir:

```tsx
            <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <span>{selected.size}/{ieds.length} IED valin</span>
              {selectedUpd > 0 && <span style={{ color: 'var(--warn, #f59e0b)' }}>{selectedUpd} uppfærðir</span>}
              {selectedNew > 0 && <span style={{ color: 'var(--success)' }}>{selectedNew} nýir</span>}
              {stats.doDaCount > 0
                ? <span>→ {stats.lnCount} LN · {stats.doDaCount} DO/DA merki</span>
                : <span>→ {stats.lnCount} LN merki</span>
              }
            </div>
```

Í aðgerðablokkinni (núverandi línur 234–252), skipta út `+ Bæta IED-um við tæki` hnappinum og Excel-hnappinum fyrir:

```tsx
                <Button
                  size="sm"
                  disabled={selected.size === 0 || importing}
                  onClick={handleImport}
                >
                  {importing ? 'Flyt inn…' : `Flytja inn — ${selectedNew} nýir, ${selectedUpd} uppfærðir`}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={selected.size === 0}
                  onClick={handleExcel}
                >
                  ↓ Excel sniðmát
                </Button>
```

- [ ] **Step 6: Type-check**

Run: `npm run build`
Expected: PASS (engar TS-villur). Ef `ProjectView` notar enn `onAddEquipment` mun build falla — það er lagað í Task 3; keyra build aftur eftir Task 3. Á þessu stigi staðfestir þú aðeins að `ImportScdModal.tsx` sjálft hafi engar innri TS-villur (t.d. ónotaðar breytur).

- [ ] **Step 7: Commit**

```bash
git add src/components/ImportScdModal.tsx
git commit -m "feat: SCD gluggi byggir módel og parar Tech key (nytt/uppfaerir)"
```

---

## Task 3: `ProjectView` — vista tæki og módel (uppfæra + bæta við)

**Files:**
- Modify: `src/pages/ProjectView.tsx`

`ProjectView` fær færslurnar úr glugganum, uppfærir/bætir við tækjum í einni vistun og skrifar módelskrá per IED.

- [ ] **Step 1: Uppfæra import á `ImportScdModal`**

Skipta út línu 11:

```tsx
import { ImportScdModal, type ScdImportEntry } from '../components/ImportScdModal';
```

(`saveModel`, `loadIedModel`, `parseModel` eru þegar flutt inn á línu 16; `IedFcda`, `Equipment` á línu 12; `uuid()` skilgreint á línum 23–28.)

- [ ] **Step 2: Bæta `handleScdImport` við**

Bæta þessu falli við á eftir `handleUploadIcd` / mismatch-handlerunum (t.d. á eftir `handleMismatchContinue`, fyrir `saveEquipment` á línu 467):

```tsx
  const handleScdImport = async (entries: ScdImportEntry[]) => {
    if (!projectId) return;
    setSaving(true);
    try {
      let updated = [...equipment];
      const modelSaves: Array<{ id: string; model: IedFcda[]; iedName: string }> = [];

      for (const { ied, model, existingId } of entries) {
        if (existingId) {
          // Uppfæra lið sem er til — eins og ICD-upphleðsla: aðeins manufacturer/model/config_version.
          updated = updated.map(e => e.id === existingId ? {
            ...e,
            manufacturer: ied.manufacturer || e.manufacturer,
            model: ied.model || e.model,
            config_version: ied.configVersion || e.config_version,
          } : e);
          modelSaves.push({ id: existingId, model, iedName: ied.name });
        } else {
          const newEq: Equipment = {
            id: uuid(), category: 'ied', code: ied.name, type: null,
            ied_name: ied.name,
            manufacturer: ied.manufacturer || null,
            model: ied.model || null,
            config_version: ied.configVersion || null,
            template_id: null,
            description: ied.desc || '',
          };
          updated = [...updated, newEq];
          modelSaves.push({ id: newEq.id, model, iedName: ied.name });
        }
      }

      await saveEquipment(updated);
      for (const { id, model, iedName } of modelSaves) {
        await saveModel(api, projectId, id, model, iedName);
      }
      setIedModels(prev => {
        const next = new Map(prev);
        for (const { id, model } of modelSaves) next.set(id, model);
        return next;
      });
      setShowScd(false);
      setEqTab('ied');
    } finally {
      setSaving(false);
    }
  };
```

- [ ] **Step 3: Tengja gluggann við nýja handlerinn**

Skipta út `{showScd && (...)}` blokkinni (núverandi línur 1163–1175):

```tsx
      {showScd && (
        <ImportScdModal
          existingIeds={ieds}
          onImport={handleScdImport}
          onClose={() => setShowScd(false)}
        />
      )}
```

- [ ] **Step 4: Type-check + öll próf**

Run: `npm run build`
Expected: PASS — engar TS-villur (`onAddEquipment` ekki lengur til staðar).

Run: `npm test`
Expected: PASS — öll próf græn (þ.m.t. ný `iedModelService` próf).

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProjectView.tsx
git commit -m "feat: SCD-innflutningur vistar modul per lid + uppfaerir lidi sem eru til"
```

---

## Task 4: Handvirk staðfesting

**Files:** (engar — handvirk prófun)

- [ ] **Step 1: Keyra dev-þjón**

Run: `npm run dev`
Opna `http://localhost:5173/merkjalisti/`.

- [ ] **Step 2: Prófa nýjan innflutning**

Opna verkefni → Tæki → IED flipi → „↑ Innflytja SCD skrá". Velja SCD með nokkrum IED-um. Staðfesta:
- Allir liðir sýna 🟢 **Nýtt** (ef engir passa við Tech key).
- Hnappurinn segir „Flytja inn — N nýir, 0 uppfærðir".
- Eftir innflutning: IED-raðir birtast, og `📂 ICD` reiturinn sýnir `✓ N merki` (módel hlaðið).

- [ ] **Step 3: Prófa endur-innflutning (uppfærsla)**

Flytja sömu SCD skrá inn aftur. Staðfesta:
- Allir liðir sýna 🟡 **Uppfærir**.
- Hnappurinn segir „Flytja inn — 0 nýir, M uppfærðir".
- Engir tvíteknir liðir í IED-listanum eftir á; merki-talning óbreytt/uppfærð.

- [ ] **Step 4: Staðfesta git-stöðu**

Run: `git status`
Expected: clean working tree (allt committað í Task 1–3).

---

## Self-Review (höfundur)

- **Spec coverage:** Markmið 1 (módel per lið) → Task 1 + 3. Markmið 2 (uppfæra við Tech key) → Task 2 (pörun) + Task 3 (vistun). Markmið 3 (sýna nýtt/uppfærir) → Task 2 step 4–5. Pörun á `code` → Task 2 `matchExistingId`. DataSet-auðgun → Task 1. ✅
- **Placeholder scan:** Engin TBD/TODO; allur kóði sýndur. ✅
- **Type consistency:** `ScdImportEntry { ied, model, existingId }` skilgreint í Task 2 og notað eins í Task 3. `flattenIedModelWithDataSets(ied, xmlText)` undirskrift eins í Task 1 og 2. `saveModel(api, projectId, id, model, iedName)` passar við núverandi undirskrift í `iedModelService.ts`. ✅
