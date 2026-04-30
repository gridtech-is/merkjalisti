# CLAUDE.md

## Commands
```bash
npm run dev       # Vite dev server — Local: http://localhost:5173/merkjalisti/ — Network: http://192.168.8.250:5173/merkjalisti/ (LAN)
npm run build     # tsc + vite build (type-checks first)
npm test          # Vitest run once
npm run test:watch
```

## Stack
React 18 + TypeScript + Vite + Octokit + React Router v6

## Architecture
Static SPA on GitHub Pages (`/merkjalisti/` base path). All project data lives as JSON files in `gridtech-is/merkjalisti-data` GitHub repo. Every save = one GitHub commit. No backend server.

## Patterns
- CSS variables only (no CSS modules) — see `src/design-tokens.css`
- All domain types in `src/types.ts`
- GitHub API in `src/github/api.ts` (GitHubApi class)
- Token stored in localStorage via `src/github/token.ts`
- Auto-commit via `useAutoCommit` hook (30s debounce, only triggers on false→true dirty transition)
- HashRouter for GitHub Pages compatibility
- `signal_library.json` og `signal_states.json` eru cached í `src/context/LibraryContext.tsx` — nota `useLibrary()` í öllum components, ALDREI `api.readJson()` beint fyrir þessar skrár
- Eftir skrif á þessar skrár: kalla `updateLibrary(data, sha)` eða `updateStates(data, sha)` til að uppfæra context

## Data repo structure
`gridtech-is/merkjalisti-data`:
- `data/signal_states.json` — Sinalmatrix state types
- `data/signal_library.json` — signal library
- `data/equipment_templates.json` — product-catalog IED templates (flat)
- `templates/bays/` — bay signal templates
- `projects/{uuid}/` — per-project data (project.json, bays/, changelog.json, testing.json, station_signals.json)
- `projects/{uuid}/ied_models/{equipment.id}.json` — parsed IED models (IedFcda[])

## Tveir aðskildir gagnageymslur
- **App repo (þessi):** `C:\Users\TheodorJónsson\Desktop\Merkjalisti\merkjalisti\`
- **Data repo:** `C:\Users\TheodorJónsson\Desktop\Merkjalisti\merkjalisti-data\` — `gridtech-is/merkjalisti-data`

## Plön og hönnun
- `docs/superpowers/specs/` — hönnunarskjöl
- `docs/superpowers/plans/` — implementation plans

---

## Staða núna — 2026-04-27

### Klárað og pushað — allt á main
- **Plan 1–3** ✅ — review workflow, station_signals.json, migration
- **LibraryView** ✅ — Merkjasafn, Stöður, Sniðmát flipar
- **OverviewTab** ✅ — heildar-listi, lítur út eins og SignalTable, stöður/alarm/Fl per-state, IS/EN skipti, FAT/SAT dálkar
- **StationSignalsTab** ✅ — review workflow
- **Plan "Stöðvar-númer"** ✅ — `Project.station_number`, cascade á `display_id`
- **Undo/redo stack** ✅ — Ctrl+Z / Ctrl+Shift+Z í BayView
- **Changelog revert** ✅
- **IEC 61850 restructure** ✅ — `do`+`da` split, `ld` úr library
- **IED model import** ✅ — ICD/IID upload, `IedFcda[]` á GitHub
- **SCD parser** ✅ — DAType/BDA, CMV/Vector/AnalogueValue, configVersion
- **FCDA picker** ✅ — `≡` takki, leitanlegur dropdown
- **Datalist autocomplete** ✅ — context-aware, auto-fill lnClass→ldInst/prefix
- **Block edit** ✅ — `handleBatchUpdate`, × hreinsunartakki við hvert IEC svæði
- **ICD upload nafnaprófun** ✅ — 3-valkosta gluggi
- **Sort by type** ✅ — ↕ Raða takki
- **Duplicate count** ✅ — × [fjöldi]
- **Plan 4 — Equipment templates** ✅
  - `EquipmentTemplateSignal`, `equipmentTemplateService.ts`, `GitHubApi.deleteFile`
  - `EquipmentTemplateEditor.tsx`, `ApplyTemplateModal.tsx`
  - LibraryView Sniðmát flipi, BayView IED chips + "↓ Sniðmát", ProjectView "⊕ Sniðmát"
- **ICD/IID innlestur lagfærður** ✅ — `config_version`, manufacturer/typeCode, mismatch-próf
- **DataSet/RCB XLM útflutningur** ✅ — `datasetService.ts`, setja inn í ICD/IID skrá
- **RCB placement fix** ✅ — nýir RCB koma á réttan stað (á eftir síðasta RCB, fyrir DOI/Inputs)
- **IEC 61850 Ref fix** ✅ — `F2540C02EF4_1/...` (ekki `F2540C02/EF4_1/...`)
- **Leit í SignalTable** ✅ — nær til IEC svæða (lnClass, ld, ied, do, da, dataset)
- **IEC dálkabreidd** ✅ — IED 130px, ldInst 85px, lnClass 75px, do/da 80px, Ref 160px
- **Lóðréttar dálkalínur** ✅ — borderRight á öllum dálkum í SignalTable og OverviewTab
- **Signal library EF merki** ✅ — EF.ST1/TR1, EF.ST2/TR2, EF.ST3/TR3 (IN >, IN >>, IN >>>)
- **zenon útflutningur** ✅ — `exportZenonXml`, `exportZenonReactionMatrix`, `exportZenonBay`, `exportZenonAllBays` í `exportService.ts`
  - **↓ zenon** hnappar í BayView (DRAFT/IN_REVIEW/LOCKED) og OverviewTab
  - Flytur út: `{display_id}-zenon-variables.xml` + `{display_id}-zenon-rematrix.xml`
  - Import í zenon: `File → Import → Variables` og `File → Import → Reaction matrix list`
  - **UTF-16 LE encoding** með BOM (0xFEFF) — zenon krefst þess
  - **SymbAddr format:** `Server_{IED}!{LD}/{Prefix}{LN}{Inst}/{DO}[/{DA}][{FC}]`
  - **CDC → TypeID:** SPS/SPC/DPC/ACT/ACD→BOOL(8), DPS→UDINT(5), MV/CMV/SAV→REAL(11), INS/INC→DINT(9)
  - **Variable element:** `<Variable ShortName=... DriverID="4" TypeID=... Matrix=...>` + Limits_0/1 (aðeins BOOL)
  - **Þrjár apartments:** `process variables list` / `driver list` / `type list`, MainVersion 15000
  - **SPI Reaction Matrix** (TypeID=1): CheckArt=0, ReaWert+ReaWertMaske=1 per stöðu, Status 512/513
  - **DPI Reaction Matrix** (TypeID=2): CheckArt=3, ReaAlarm enum-teljari 0–3, State_0 catch-all Status=640
  - **DPI state röðun:** OPEN('01')→CLOSED('10')→INTERMEDIATE('00')→FAULT('11')
- **Block eyða** ✅ — `onBatchDelete` prop í SignalTable, "Eyða völdum" hnappur í block edit toolbar
- **Vista við yfirganga** ✅ — `navigateAway()` í BayView vistar ef dirty áður en farið er milli reita eða yfir á aðrar síður
- **useAutoCommit unmount-vista** ✅ — hookinn vistar strax við unmount ef dirty, hindrar tvöföldun með `isDirtyRef`
- **LibraryContext** ✅ — `signal_library` + `signal_states` cached einu sinni, deilt alls staðar via `useLibrary()`
- **84 testar** ✅, build ✅

### Óklárað / framundan
- **SaaS/viðskiptavinir spec** ✅ committað — `docs/superpowers/specs/2026-04-23-saas-vidskiptavinir-design.md` — Supabase, RLS, RBAC, IP allowlist, audit log — **framkvæmd ekki hafin**
- **Plan 5** — ekki skilgreint enn

### IEC 61850 gagnalíkan
- `SignalLibraryEntry` hefur: `iec61850_ln`, `iec61850_do`, `iec61850_da`, `iec61850_fc`, `iec61850_cdc`, `iec61850_dataset` (ekki `iec61850_ld` — instance-specific)
- `BaySignal` hefur öll svæðin + `iec61850_ld`, `iec61850_ied`, `iec61850_ln_prefix`, `iec61850_ln_inst`, `iec61850_rcb`, `iec61850_dataset_entry`
- IED módel geymt sem `IedFcda[]` í `projects/{id}/ied_models/{equipment.id}.json`

### Git staða
- App repo: `main`, allt pushað ✅ (fram að zenon+block eyða+vista við yfirganga — ekki pushað enn)
- Data repo: `main`, allt pushað ✅

### Athugið á nýrri tölvu
```bash
git clone git@github.com:gridtech-is/merkjalisti.git
cd merkjalisti
npm install
cd ..
git clone git@github.com:gridtech-is/merkjalisti-data.git
```
GitHub token þarf að setja í localStorage í appinu.

---

## Claude Code uppsetning

```
/plugin install superpowers
/plugin install feature-dev
/plugin install playwright
```

### Vinnuferli
- **Íslenska** í öllum commits, plans, og samtölum
- **Spyrja áður en committað** / push-að / óafturkræfar aðgerðir
- **Engin scope creep** — gera ekki meira en beðið er um
- **CSS variables** (engin CSS modules)
- **Commits á íslensku**, short subject + body

### TDD og próf
- `npm run build` + `npm test` áður en sagt er "búið"
- Test skrár: `*.test.ts` í `src/`
