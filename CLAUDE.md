# CLAUDE.md

## Commands
```bash
npm run dev       # Vite dev server at http://localhost:5173/merkjalisti/
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

## Staða núna — 2026-04-24

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
- **58 testar** ✅, build ✅

### Git staða
- App repo: `main`, allt pushað ✅
- Data repo: `main`, allt pushað ✅

### Óklárað / framundan
- **SaaS/viðskiptavinir spec** — `docs/superpowers/specs/2026-04-23-saas-vidskiptavinir-design.md` — Supabase, RLS, RBAC, IP allowlist, audit log
- **Plan 5** — ekki skilgreint enn

### IEC 61850 gagnalíkan
- `SignalLibraryEntry` hefur: `iec61850_ln`, `iec61850_do`, `iec61850_da`, `iec61850_fc`, `iec61850_cdc`, `iec61850_dataset` (ekki `iec61850_ld` — instance-specific)
- `BaySignal` hefur öll svæðin + `iec61850_ld`, `iec61850_ied`, `iec61850_ln_prefix`, `iec61850_ln_inst`, `iec61850_rcb`, `iec61850_dataset_entry`
- IED módel geymt sem `IedFcda[]` í `projects/{id}/ied_models/{equipment.id}.json`

### Git staða
- App repo: á `main`, **10 commits ópushaðir** — push á GitHub
- Data repo: clean

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
