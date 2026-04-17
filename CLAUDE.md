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
- `data/signal_library.json` — signal library (381 entries)
- `data/equipment_templates.json` — 16 product-catalog IED templates (flat)
- `templates/bays/` — bay signal templates
- `projects/{uuid}/` — per-project data (project.json, bays/, changelog.json, testing.json, station_signals.json)

## Tveir aðskildir gagnageymslur
- **App repo (þessi):** `/Users/teddi/Documents/merkjalisti/` — React kóði
- **Data repo:** `/Users/teddi/Documents/Merkja listi/merkjalisti-data/` — `gridtech-is/merkjalisti-data`, JSON gögn

## Plön og hönnun
Plön eru geymd í `docs/superpowers/`:
- `docs/superpowers/specs/` — hönnunarskjöl (áður en implementation plan er skrifað)
- `docs/superpowers/plans/` — implementation plans með tasks og TDD skrefum

---

## Staða núna — 2026-04-17

### Klárað og committað
- **Plan 3 — Stöðvarmerki + Heildar listi tabs** ✅ (review workflow, station_signals.json, migration)
- **LibraryView** ✅ (Merkjasafn, Stöður, Sniðmát flipar)
- **Phase back navigation** ✅ (← takki í PhaseBar)
- **OverviewTab** ✅ (aggregated signal listi + Excel export)
- **StationSignalsTab** ✅ (review workflow fyrir stöðvarmerki)

### Óklárað (WIP — committað sem "WIP" svo hægt sé að sækja)
- **SCD import** — `src/components/ImportScdModal.tsx`, `src/services/scdParser.ts`, `src/services/signalTemplate.ts`
  - Virkni: importa IEC 61850 SCD skrá, draga út IEDs, búa til Excel template með VLOOKUP í Merkjasafn
  - Tengt inn í ProjectView (línur 10, 574)
  - **Eftir:** prófa end-to-end með raunverulegri SCD skrá, staðfesta að Excel template virki rétt í Excel/LibreOffice

### Næst á dagskrá
- **Plan 4 — Equipment templates með signal auto-populate**
  - Hönnun: `docs/superpowers/specs/2026-04-17-plan4-equipment-templates-design.md` ✅
  - Implementation plan: **ekki skrifað ennþá** ← byrja hér
  - 6–7 tasks áætlað (sjá kafla 9 í spec): types → applyTemplateToBay (TDD) → CRUD → Editor → ApplyModal → Save-as-template modal → smoke test

### Hvar halda áfram
1. Ef þú vilt klára **SCD import**: prófa með raunverulegri SCD skrá í dev, staðfesta UI flow
2. Ef þú vilt fara í **Plan 4**: lestu spec-ið og bið Claude um "skrifaðu implementation plan fyrir plan 4" — notar `superpowers:writing-plans`
3. Önnur óklárið plön: `docs/superpowers/plans/2026-04-16-workflow-features.md` og `2026-04-17-library-view.md` (elstu delar gætu verið búnir)

### Git staða
- App repo (`merkjalisti`): á `main`, push-að á `origin/main` eftir þessa session
- Data repo (`merkjalisti-data`): clean, up-to-date með `origin/main`

### Athugið á nýrri tölvu
```bash
git clone git@github.com:gridtech-is/merkjalisti.git
cd merkjalisti
npm install
# Og í systur-möppu:
cd ..
git clone git@github.com:gridtech-is/merkjalisti-data.git
```
GitHub token þarf að setja í localStorage í appinu (útskýrt í `src/github/token.ts`).
