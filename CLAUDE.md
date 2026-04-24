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

### Klárað og committað
- **Plan 1–3** ✅ (review workflow, station_signals.json, migration)
- **LibraryView** ✅ (Merkjasafn, Stöður, Sniðmát flipar)
- **OverviewTab** ✅ (aggregated signal listi + Excel export)
- **StationSignalsTab** ✅ (review workflow fyrir stöðvarmerki)
- **Plan "Stöðvar-númer"** ✅ — `Project.station_number` single source of truth, cascade á `display_id`
- **Undo/redo stack** ✅ — Ctrl+Z / Ctrl+Shift+Z í BayView
- **Changelog revert** ✅ — afturkalla `FIELD_CHANGED` breytingar úr breytingasögu
- **IEC 61850 restructure** ✅ — `iec61850_do_da` → `iec61850_do` + `iec61850_da`, `iec61850_ld` fjarlægt úr `SignalLibraryEntry`
- **IEC 61850 dálkar sameinaðir** ✅ — 13 dálkar í SignalTable
- **IED model import** ✅ — hlaða upp ICD/IID skrá, vistað sem `IedFcda[]` á GitHub
- **SCD parser uppfærsla** ✅ — `DAType`/`BDA` þáttur, structured DAs með punkt-notation
- **FCDA picker** ✅ — `≡` takki á IED reit, leitanlegur dropdown, fyllir IEC svæði sjálfkrafa
- **Datalist autocomplete** ✅ — ldInst/lnClass/doName/daName reitir, context-aware síun
- **Auto-fill** ✅ — þegar lnClass valið með eitt ldInst/prefix
- **Block edit batch fix** ✅ — `handleBatchUpdate` í BayView
- **ICD upload nafnaprófun** ✅ — 3-valkosta gluggi
- **Sort by type** ✅ — ↕ Raða takki í BayView
- **Duplicate count** ✅ — × [fjöldi] í afrita valin

### Klárað en ekki pushað (10 commits)
- **Plan 4 — Equipment templates** ✅ (7 commits)
  - `EquipmentTemplateSignal` gerð, `signals[]` + `iec61850_edition` á `EquipmentTemplate`
  - `equipmentTemplateService.ts` — CRUD + `createTemplateFromIED` + `applyTemplateToBay`
  - `GitHubApi.deleteFile` — ný aðferð
  - `EquipmentTemplateEditor.tsx` — modal með signal töflu, auto-fill úr library, 30s auto-commit
  - `ApplyTemplateModal.tsx` — velur sniðmát, preview count, "Beita" á IED í reit
  - `LibraryView` Sniðmát flipi — sýnir product catalog + signal templates, opnar editor
  - `BayView` — IED chips ofan við merkatöflu, "↓ Sniðmát" takki
  - `ProjectView` — "⊕ Sniðmát" takki á IED row, `SaveTemplateModal`
- **ICD/IID innlestur lagfærður** ✅ (3 commits)
  - `Equipment.config_version` — nýr reitur í `types.ts`
  - `scdParser`: les `configVersion` úr IED element, dýpt aukin í `expandDa` (1→3) svo CMV/Vector/AnalogueValue-gerðir (t.d. `A.phsA.cVal.mag.f`) finnast
  - `iedModelService`: `ParsedIedMeta` skilar `manufacturer`, `typeCode`, `configVersion`; velur IED með flest LD (forðast template IED)
  - `ProjectView`: `.iid,.cid,.scd,.xml` samþykkt, metadata fyllt inn sjálfvirkt úr skrá, "Líkan"→"Tegund", "Versía" dálkur, mismatch-próf á móti tech key
  - 52 testar ✅, build ✅

### Óklárað / framundan
- **Push** — 10 commits á `main`, ekki enn á GitHub
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
