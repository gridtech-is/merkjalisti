# Plan 3 — Verkefnissíur: Stöðvarmerki + Heildar listi

**Dagsetning:** 2026-04-17
**Status:** Hönnun samþykkt, tilbúin fyrir implementation plan

## 1. Bakgrunnur

Í `ProjectView.tsx` eru tveir flipar með placeholder "kemur í Plan 3":
- **Stöðvarmerki** — merki sem tilheyra stöðinni en ekki einstökum reit
- **Heildar listi** — öll merki í verkefninu saman, síanleg og exportanleg

Gagnavistun fyrir `stationSignals` er nú þegar til í `projectService.ts` (lesið og skrifað í `station_signals.json`), en aldrei rendrað. Þetta plan klárar þessa tvo flipa, þar á meðal review workflow á station signals sem speglar bay review workflow fullkomlega.

## 2. Markmið og umfang

**Inni:**
- Stöðvarmerki flipi með full review workflow (DRAFT → IN_REVIEW → LOCKED) eins og bays
- Heildar listi flipi: read-only aggregated view með síum, toggles og Excel export
- Gagnalíkan breyting: `stationSignals` fer úr `BaySignal[]` í `StationSignals` object (með status/review)
- Auto-migration fyrir gömul skráarsnið
- Service functions: `loadStation`, `saveStation`, `sendStationForReview`, `approveStation`, `rejectStation`

**Ekki inni (sér plön seinna):**
- SCD samanburður (WIP er þegar í `scdParser.ts` + `ImportScdModal.tsx`, óskuldbundið)
- FAT/SAT sem project-level yfirlitsflipi (er þegar per reit)
- Útflutningur sem sér flipi (Excel takki er í OverviewTab — nóg YAGNI)
- IID innflutningur (sér plan seinna)

## 3. Arkitektúr

### 3.1 Skráarstrúktúr

```
src/
  components/
    StationSignalsTab.tsx     ← NÝR — editable station signals með review
    OverviewTab.tsx           ← NÝR — aggregated read-only listi
  services/
    stationService.ts         ← NÝR — loadStation, saveStation, review-functions
    projectService.ts         ← BREYTA — stationSignals gerð í ProjectFiles + migration
  pages/
    ProjectView.tsx           ← BREYTA — skipta placeholders út
  types.ts                    ← BREYTA — StationSignals type + TargetType 'station'
```

### 3.2 Gagnalíkan

**Ný gerð:**
```typescript
export interface StationSignals {
  status: BayStatus;              // DRAFT | IN_REVIEW | LOCKED
  review: BayReview | null;
  signals: BaySignal[];
}
```

**ProjectFiles breyting:**
```typescript
// ÁÐUR
stationSignals: BaySignal[];
stationSignalsSha: string;

// EFTIR
stationSignals: StationSignals;
stationSignalsSha: string;
```

**Changelog `TargetType`:** bæta við `'station'` (þegar fyrir: `'project'`, `'bay'`, `'signal'`, `'equipment'`).
- `target_id = projectId` (aðeins einn station per verkefni)

**Skráarsnið `station_signals.json`:**
```json
{
  "status": "DRAFT",
  "review": null,
  "signals": []
}
```

### 3.3 Migration

Auto-migration í `loadProjectFiles`:
```typescript
const raw = await api.readJson<unknown>(`${base}/station_signals.json`);
const stationSignals: StationSignals = Array.isArray(raw.data)
  ? { status: 'DRAFT', review: null, signals: raw.data as BaySignal[] }
  : raw.data as StationSignals;
```

Ekkert background-migration — skráin er vistuð á nýja sniðinu næst þegar notandi vistar breytingu (YAGNI).

## 4. Stöðvarmerki flipi (editable)

### 4.1 Props og state

```typescript
interface Props { projectId: string; }

// Internal state
const [station, setStation] = useState<StationSignals | null>(null);
const [stationSha, setStationSha] = useState('');
const [equipment, setEquipment] = useState<Equipment[]>([]);
const [library, setLibrary] = useState<SignalLibraryEntry[]>([]);
const [states, setStates] = useState<SignalState[]>([]);
const [dirty, setDirty] = useState(false);
```

### 4.2 UI hegðun eftir status

| Status | SignalTable | Takki |
|--------|-------------|-------|
| `DRAFT` | editable, `reviewMode=false` | "Senda í yfirferð" |
| `IN_REVIEW` | `reviewMode=true` (flag column, comment popup) | "Samþykkja" / "Hafna" |
| `LOCKED` | read-only | "Opna aftur" (fer í DRAFT) |

Sömu reglur og `BayView` fylgir — endurnotum sömu UI patterns.

### 4.3 Phase-lock

Sama regla og bays: bæta við/eyða merki bannað ef `project.phase !== 'DESIGN'`.

### 4.4 Save flæði

- `onUpdate` / `onDelete` → `setStation(prev => ...)` + `setDirty(true)`
- `useAutoCommit` hook (30s debounce) → `saveStation(api, projectId, { station, sha }, project.phase)`
- Review actions (`send`/`approve`/`reject`) → immediate save (ekki bíða eftir debounce)

### 4.5 Equipment_code

Station signals nota `equipment_code` úr project equipment lista (ekki reit-bundið). T.d. "RTU1", "DC1". Engin sérstök meðferð.

## 5. Heildar listi flipi (read-only aggregator)

### 5.1 Gagnaflæði

```typescript
interface Row {
  source: { kind: 'bay'; bayId: string; displayId: string; bayName: string } 
        | { kind: 'station' };
  signal: BaySignal;
}
```

Load:
1. `loadProjectFiles(api, projectId)` → `equipment`, `stationSignals` (nú `StationSignals` obj)
2. `listBays(api, projectId)` + `Promise.all(bays.map(b => loadBay(api, projectId, b.id)))`
3. Flatten:
   - Fyrir hvern `bay`: `bay.signals.map(s => ({ source: { kind: 'bay', bayId, displayId, bayName }, signal: s }))`
   - Fyrir `stationSignals.signals`: `.map(s => ({ source: { kind: 'station' }, signal: s }))`

### 5.2 Síur og toggles

Efst yfir töflunni (row 1):
- **Leit** — matches `signal.signal_name`, `signal.name_is`, `signal.name_en`, eða IEC61850 strengur
- **Reit** multiselect dropdown með checkbox — values: allir bay IDs + `'station'`. Sjálfgefið allt valið.
- **Fasi** dropdown — `Allt | DESIGN | FROZEN | REVIEW | FAT | SAT`
- **Upprunatengsl** dropdown — `Allt | IED | HARDWIRED`

Efst yfir töflunni (row 2):
- Toggle "Bara alarm" — `signal.is_alarm === true`
- Toggle "Bara óprófað" — `!signal.fat_tested || !signal.sat_tested`
- Teljari: "Sýnd {filtered.length} af {rows.length} merkjum"
- Takki "Flytja út Excel"

### 5.3 Tafla

| Dálkur | Innihald |
|--------|----------|
| Reit | bay displayId (smellanlegt → `/projects/:id/bays/:bayId`) eða "Stöð" (texti) |
| Tæki | `signal.equipment_code` |
| Kóði | `signal.signal_name` |
| Nafn IS | `signal.name_is` |
| Nafn EN | `signal.name_en` eða "—" |
| Alarm | ✓ ef `is_alarm`, annars "—" |
| Klass | `alarm_class` (1/2/3) eða "—" |
| Upprunatengsl | `source_type` (IED / HARDWIRED) |
| IEC 61850 | sameinaður strengur `LD/LN.DO.DA` (eða "—" ef allt null) |
| Fasi | `phase_added` |
| FAT | ✓ (grænn ef PASS, rauður ef FAIL) eða "—" |
| SAT | ✓ (grænn ef PASS, rauður ef FAIL) eða "—" |

### 5.4 Útflutningur

Endurnotum `exportAllBaysToExcel(bays, projectName)`. Fyrir station signals bætum við gervireit við bays array:

```typescript
const syntheticStationBay: Bay = {
  id: 'station', station: project.name, voltage_level: '', bay_name: 'Stöðvarmerki',
  display_id: 'STÖÐ', equipment_ids: [], signals: station.signals,
  status: station.status, review: station.review,
};
exportAllBaysToExcel([...allBays, syntheticStationBay], project.name);
```

Engin breyting á `exportService.ts` sjálfu.

### 5.5 Performance

- `useMemo` á `rows` (bara þegar bays/station breytast)
- `useMemo` á `filtered` (þegar filters breytast)
- Initial load: `1 + N` API calls (einn fyrir project/station, N fyrir bays). Fyrir N=50 er þetta ~50 parallel fetches í gegnum Octokit — nóg hratt. Caching seinna ef þörf.

## 6. Services

### 6.1 stationService.ts (nýr)

```typescript
export interface StationFile { station: StationSignals; sha: string; }

export async function loadStation(api, projectId): Promise<StationFile>
export async function saveStation(api, projectId, file: StationFile, phase: ProjectPhase): Promise<StationFile>
export async function sendStationForReview(api, projectId, file: StationFile, sentBy): Promise<StationFile>
export async function approveStation(api, projectId, file: StationFile, reviewedBy, comment): Promise<StationFile>
export async function rejectStation(api, projectId, file: StationFile, reviewedBy, comment): Promise<StationFile>
```

Mirror á `sendBayForReview` / `approveBay` / `rejectBay` í `bayService.ts`. Notar `target_type: 'station'` og `target_id: projectId` í changelog entries.

### 6.2 projectService.ts breytingar

- `createProject`: `stationSignals` → `{ status: 'DRAFT', review: null, signals: [] }`
- `loadProjectFiles`: read-time migration (array → wrapped object)
- `saveProjectFiles`: writes new shape — engin breyting á API

## 7. Error handling

- **Load villur** — sama pattern og BayView: `loadError` state, "Villa við að hlaða" skilaboð
- **Save villur** — `alert('Villa við að vista. Reyndu aftur.')`, sama pattern og `onAdvance` í ProjectView
- **Tómir reitir í OverviewTab** — "Engin merki í verkefninu" skilaboð
- **Loading state** — "Hleður..." skilaboð

## 8. Testing

- **Nýr service test:** `stationService.test.ts` — mirror á `bayService.test.ts`:
  - `loadStation` með gömlu sniði (array) → migration vefur
  - `loadStation` með nýju sniði → óbreytt
  - `sendStationForReview` → status verður `IN_REVIEW`, changelog entry með `target_type: 'station'`
  - `approveStation` → status verður `LOCKED`
  - `rejectStation` → status verður `DRAFT` með `status: 'REJECTED'` í review
- **projectService.test.ts update:** bæta við migration test fyrir station_signals

Component testar sleppum (núverandi venja í verkefni).

## 9. ProjectView breytingar

- Skipta út placeholders í línum ~558-567 með `<StationSignalsTab projectId={projectId} />` og `<OverviewTab projectId={projectId} />`
- Bæta við status-merki við hliðina á "Stöðvarmerki" tab label (sami litakóði og bays):
  - `DRAFT` → engin markering
  - `IN_REVIEW` → gulur punktur eða circle
  - `LOCKED` → grænn ✓

## 10. Áætluð umfang

5–6 tasks:
1. Types + migration (types.ts, projectService.ts)
2. stationService.ts + testar
3. StationSignalsTab component
4. OverviewTab component + Excel export
5. ProjectView wiring + tab status indicator
6. Manual smoke test + commit
