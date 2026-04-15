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
- `templates/bays/` — bay signal templates
- `projects/{uuid}/` — per-project data (project.json, bays/, changelog.json, testing.json)
