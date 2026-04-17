# Plan 4 — Equipment templates með signal auto-populate

**Dagsetning:** 2026-04-17
**Status:** Hönnun samþykkt, tilbúin fyrir implementation plan

## 1. Bakgrunnur

Núverandi `data/equipment_templates.json` er flat JSON með 16 IED templates sem innihalda bara manufacturer/model/description. Notandi vill að hægt sé að tengja IEC61850 signal-mappings við templates þannig að þegar sama IED er notuð aftur í nýju verkefni/reit, er hægt að auto-populate IEC61850 addressur á merki í stað þess að fylla handvirkt út.

Kjarninn: templates verða "discovered from use" — notandi setur upp IED með merkjum í verkefni, gerir sniðmát af því. Seinna beitt á nýja IED af sömu týpu.

## 2. Markmið og umfang

**Inni:**
- Nýtt gagnalíkan: `EquipmentTemplateSignal` + `signals[]` í `EquipmentTemplate` + `iec61850_edition` field
- Ný skráarstrúktúr: `data/equipment_templates/{uuid}.json` (mirror á `data/bay_templates/`)
- Services: list/load/save/delete + `createTemplateFromIED` + `applyTemplateToBay` (pure)
- UI: "Gera sniðmát" í ProjectView equipment tab (IED rows)
- UI: "Sækja sniðmát" í BayView (per IED equipment)
- UI: Editor í Library > Sniðmát > Tækjasniðmát
- IED only (ekki apparatus í þessu plani)

**Ekki inni:**
- Migration á 16 existing product-catalog templates úr flat skrá
- Editor fyrir product-catalog templates (sýning read-only)
- Export/import templates til disk
- Apparatus templates (aflrofi, skilrofi o.s.frv.)
- Multi-edition í einni template skrá (sér skrá per edition)

## 3. Arkitektúr

### 3.1 Skráarstrúktúr

```
src/
  types.ts                                  ← MODIFY — bæta EquipmentTemplateSignal + signals[] + edition
  services/
    equipmentTemplateService.ts             ← CREATE — CRUD + createFromIED + applyToBay
    equipmentTemplateService.test.ts        ← CREATE — tests fyrir applyToBay og createFromIED (pure + CRUD mocks)
  components/
    EquipmentTemplateEditor.tsx             ← CREATE — editor modal með signal lista
    ApplyTemplateModal.tsx                  ← CREATE — notandi velur template, confirm, apply
  pages/
    LibraryView.tsx                         ← MODIFY — Tækjasniðmát undirflipi fær editor-opening og listi báðra gerða
    ProjectView.tsx                         ← MODIFY — "⊕ Gera sniðmát" takki við IED rows
    BayView.tsx                             ← MODIFY — "↓ Sækja sniðmát" takki per IED equipment chip
```

### 3.2 Gagnalíkan

**Ný gerð:**
```typescript
export interface EquipmentTemplateSignal {
  id: string;                // uuid per line, stable fyrir editing
  library_id: string;        // references SignalLibraryEntry.id
  signal_name: string;       // t.d. "Pos.stVal" — auto-captured from source bay signal
  ld_inst: string | null;
  prefix: string | null;
  ln_class: string | null;
  ln_inst: string | null;
  do_name: string | null;
  da_name: string | null;
}
```

**EquipmentTemplate útvíkkað:**
```typescript
export interface EquipmentTemplate {
  id: string;
  name: string;
  category: EquipmentCategory;
  apparatus_type?: ApparatusType;
  manufacturer?: string;
  model?: string;
  description?: string;
  iec61850_edition?: '1' | '2' | '2.1';     // NEW
  signals: EquipmentTemplateSignal[];       // NEW — default []
}
```

### 3.3 Tvö kerfi hlið við hlið (ekkert migration í þessu plani)

- **Product catalog** (`data/equipment_templates.json` — 16 entries):
  - Óbreytt, notað fyrir manufacturer/model/description autofill í ProjectView þegar IED er bætt við
  - `signals` og `iec61850_edition` fá default gildi ef vantar (empty array, undefined)
- **Signal templates** (`data/equipment_templates/{uuid}.json` — byrjar tóm):
  - Nýtt signal-enabled kerfi
  - Býr til notandi via "Gera sniðmát" á IED í verkefni

**Library UI sýnir bæði** með "Product catalog" vs "Signal template" badge.

## 4. Services

### 4.1 equipmentTemplateService.ts

```typescript
export interface EquipmentTemplateFile {
  template: EquipmentTemplate;
  sha: string;
}

// CRUD via data/equipment_templates/ directory
export async function listEquipmentTemplates(api: GitHubApi): Promise<EquipmentTemplate[]>
export async function loadEquipmentTemplate(api: GitHubApi, id: string): Promise<EquipmentTemplateFile>
export async function saveEquipmentTemplate(
  api: GitHubApi,
  file: EquipmentTemplateFile,
  isNew: boolean
): Promise<EquipmentTemplateFile>
export async function deleteEquipmentTemplate(api: GitHubApi, id: string): Promise<void>

// Create template from existing IED signals
export async function createTemplateFromIED(
  api: GitHubApi,
  params: {
    name: string;
    edition: '1' | '2' | '2.1';
    manufacturer?: string;
    model?: string;
    description?: string;
    iedCode: string;
    baySignals: BaySignal[];   // all signals across bays where equipment_code === iedCode
  }
): Promise<EquipmentTemplateFile>
  // Filters baySignals by equipment_code === iedCode
  // Maps each to EquipmentTemplateSignal:
  //   id: new uuid
  //   library_id: signal.library_id (required — throws if any signal lacks library_id)
  //   signal_name: signal.signal_name
  //   ld_inst: signal.iec61850_ld
  //   prefix: signal.iec61850_ln_prefix
  //   ln_class: signal.iec61850_ln
  //   ln_inst: signal.iec61850_ln_inst
  //   do_name, da_name: split signal.iec61850_do_da on first "."
  // Creates template með id=uuid, category='ied', signals=mapped
  // Writes data/equipment_templates/{uuid}.json

// Pure function — apply template to bay signals
export function applyTemplateToBay(
  template: EquipmentTemplate,
  iedCode: string,
  baySignals: BaySignal[]
): { updated: BaySignal[]; matchedCount: number; skippedCount: number }
  // For each template_signal in template.signals:
  //   matching = baySignals.filter(s => s.equipment_code === iedCode && s.library_id === template_signal.library_id)
  //   if matching.length > 1: narrow by signal_name === template_signal.signal_name
  //   if match found: fill IEC61850 fields:
  //     iec61850_ld = ld_inst
  //     iec61850_ln_prefix = prefix
  //     iec61850_ln = ln_class
  //     iec61850_ln_inst = ln_inst
  //     iec61850_do_da = (do_name && da_name) ? `${do_name}.${da_name}` : do_name ?? null
  //   else: skip (no signals added per user decision)
  // Returns new array + counts for UI feedback
```

### 4.2 DO/DA split+join edge cases

- On create: `split(".", 1)` or `split(/\.(.+)/)` — first `.` separator. `"Pos.stVal"` → `["Pos", "stVal"]`, `"Mod"` → `["Mod", null]`, `null` → `[null, null]`.
- On apply: `do_name && da_name` → `"${do}.${da}"`. If only `do_name`, use it alone. If both null, set `iec61850_do_da = null`.

## 5. UI flows

### 5.1 Save-as-template from IED (ProjectView)

Í `ProjectView` equipment tab, IED rows fá nýjan "⊕ Gera sniðmát" takki.

**Takki virkur ef:** IED-merkið er til og það eru merki í einhverjum reit með `equipment_code === ied.code`.

**Click flow:**
1. Modal opnast með formi: nafn (default: `${manufacturer} ${model}` ef til), edition dropdown (1 / 2 / 2.1, default '2'), description textarea
2. Preview: "Safnað {N} merkjum úr {bayCount} reit(um)"
3. "Vista" → kallar `createTemplateFromIED`
4. Success toast + modal lokast

**Villa-meðhöndlun:** Ef einhver bay signal vantar `library_id` (custom signal ekki í library) → tilkynning "Sniðmát geta ekki innihaldið sérsniðin merki. Vinsamlegast tengdu öll merkin við Merkjasafn fyrst."

### 5.2 Apply template to bay (BayView)

Í `BayView`, við hliðina á hverri IED equipment chip (sem er valin í bay.equipment_ids), bætist lítill "↓ Sniðmát" takki.

**Takki virkur ef:** IED er í bay.equipment_ids.

**Click flow:**
1. Modal opnast: `ApplyTemplateModal`
2. Listi af templates þar sem model matches IED model (ef hægt) — ef ekkert match, sýnir alla templates
3. Notandi velur template → preview: "Mun uppfæra IEC61850 á N merkjum í reitnum"
4. "Beita" → kallar `applyTemplateToBay` → `setBayFile`, markar `isDirty=true`
5. Toast: "Uppfærði IEC61850 á N merkjum" (eða "0 af M merkjum matched")

### 5.3 Editor í Library (LibraryView)

Í núverandi `TemplatesTab > equipment` undirflipa:

**Listi (uppfærður):**
- Product catalog (úr flat skrá) — badge "Product catalog", read-only
- Signal templates — badge "Sniðmát (Ed{edition}, {signals.length} merki)"
- Smella á signal template → opnar `EquipmentTemplateEditor` modal

**Editor modal:**
- Header: name input, manufacturer, model, edition dropdown, description textarea
- Signal tafla með dálkum:
  - ✕ (delete row)
  - Library merki (searchable dropdown — sýnir library entries með code + name_is)
  - Signal name (text input — auto-fills from selected library entry)
  - LD Inst, Prefix, LN Class, LN Inst, DO Name, DA Name (text inputs)
- "+ Bæta við línu" takki neðst
- Auto-save via `useAutoCommit` (30s debounce) — sama mynstur og bay
- "Eyða sniðmáti" takki (með `confirm()` prompt)

## 6. Error handling

- **Load failures:** error state í LibraryView templates listi, "Villa við að hlaða sniðmátum. Reyndu aftur."
- **Save failures:** alert "Villa við vistun. Reyndu aftur."
- **Missing library_id on bay signals when creating template:** block with specific error message
- **Empty signals in template:** leyft (notandi getur vistað tómt template og fyllt seinna)
- **Template apply with 0 matches:** info toast, ekki villa

## 7. Testing

- **Service unit testar** (`equipmentTemplateService.test.ts`):
  - `applyTemplateToBay` pure function:
    - Updates IEC61850 on matching signals (library_id + equipment_code)
    - Tiebreaker by signal_name when multiple matches
    - Skips signals not in template
    - Handles null do_name/da_name correctly
    - Returns correct matchedCount / skippedCount
  - `createTemplateFromIED`:
    - Filters baySignals by equipment_code
    - Captures IEC61850 fields correctly
    - Splits iec61850_do_da into do_name + da_name
    - Throws if any matched bay signal lacks library_id
  - CRUD: list/load/save/delete with mocked API

- **Component testar:** sleppt (núverandi venja — pages/components ekki unit-testaðir)

## 8. ProjectView + BayView breytingar

Í ProjectView: IED table row fær lítinn "⊕ Sniðmát" takka við hliðina á "Uppfæra" takkanum. Tengist `createTemplateFromIED` + modal formi.

Í BayView: hver equipment chip sem er valin (bay.equipment_ids.includes(eq.id)) og er í category 'ied' fær lítinn "↓ Sniðmát" takka við hliðina. Tengist `ApplyTemplateModal`.

## 9. Áætlað umfang

6–7 tasks:
1. Types + empty service scaffold
2. applyTemplateToBay + createTemplateFromIED + tests (TDD)
3. CRUD service functions (list/load/save/delete) + tests
4. EquipmentTemplateEditor component + Library editor integration
5. ApplyTemplateModal + BayView integration
6. Save-as-template modal + ProjectView integration
7. Manual smoke test
