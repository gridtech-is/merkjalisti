# Stöðvar-númer á verkefni

**Dagsetning:** 2026-04-20
**Status:** Hönnun samþykkt, tilbúin fyrir implementation plan

## 1. Bakgrunnur

Í dag hefur `Project` ekkert stöðvar-númer. Stöðvar-upplýsingar eru aðeins á `Bay` nivói (`Bay.station: string`) og þarf að slá inn handvirkt í hverjum bay. Það leiðir til endurtekninga og mögulegs ósamræmis innan sama verkefnis — tveir reitir á sömu stöð geta endað með mismunandi `station` gildi.

Notandinn vill slá stöðvar-númerið einu sinni inn þegar verkefni er stofnað og fá það sjálfkrafa notað alls staðar í verkefninu.

## 2. Markmið og umfang

**Inni:**
- Bæta `station_number: string` (numeric-only, required) við `Project` type
- Bæta við input-reit í `NewProject.tsx` step 1 við hlið „Heiti dreifistöðvar"
- Fjarlægja `Bay.station` field — lesið beint úr `project.station_number` þar sem þörf er á
- Fjarlægja `BayTemplate.station` field (templates eru verkefnis-óháð)
- Ritstýranlegt í project settings — breyting endurspeglast alls staðar
- Próf: `createProject` með station number, validation, single-source-of-truth

**Ekki inni (YAGNI):**
- Migration á núverandi verkefnum — notandi eyðir þeim
- Auto-fyll í Excel export / merkjalistum (sér feature seinna ef óskað)
- Auto-fyll í SCD import (sér feature seinna ef óskað)
- Flóknari format (leading zeros, ekki-numeric) — aðeins tölustafir

## 3. Gagnalíkan

### 3.1 Project (breyting)
```ts
export interface Project {
  id: string;
  name: string;
  station_number: string;   // NÝTT — numeric-only, required
  description: string;
  created: string;
  phase: ProjectPhase;
  review: ProjectReview | null;
}
```

Geymt sem `string` (ekki `number`) til samræmis við núverandi `Bay.station` notkun og til að leyfa leading zeros ef síðar er þörf. Validation á UI lagi tryggir að aðeins tölustafir berist inn.

### 3.2 Bay (breyting)
```ts
export interface Bay {
  id: string;
  // station: string;  ← FJARLÆGT
  voltage_level: string;
  bay_name: string;
  display_id: string;
  equipment_ids: string[];
  signals: BaySignal[];
  status: BayStatus;
  review: BayReview | null;
}
```

### 3.3 BayTemplate (breyting)
```ts
export interface BayTemplate {
  template_name: string;
  // station: string;  ← FJARLÆGT
  voltage_level: string;
  bay_name: string;
  display_id: string;
  equipment_codes: string[];
  signals: Omit<BaySignal, 'phase_added'>[];
}
```

## 4. Arkitektúr

### 4.1 Skráar sem breytast

```
src/
  types.ts                        ← Project, Bay, BayTemplate breytingar
  services/
    projectService.ts             ← createProject tekur stationNumber
    projectService.test.ts        ← nýtt test fyrir stationNumber
  pages/
    NewProject.tsx                ← bæta við input og validation
  components/
    (allir sem nota bay.station)  ← skipta út fyrir project.station_number
```

### 4.2 `createProject` signature
```ts
export async function createProject(
  api: GitHubApi,
  name: string,
  stationNumber: string,          // NÝTT
  createdBy: string
): Promise<ProjectFiles>
```

Við köllum í `createProject(api, name.trim(), stationNumber.trim(), userName)` í `NewProject.handleCreate`.

### 4.3 Notkun á `project.station_number`

Alls staðar þar sem `bay.station` var lesið þarf að uppfæra. Staðirnir finnast með `grep -r "bay.station\|\.station" src/` og sía út ekki-viðeigandi (t.d. `fat_tested`). Helstu líklegir staðir:
- Bay render componentar (BayCard, BayView)
- Excel export kóði
- Breadcrumb / heading sem sýnir stöð

Þessir fá `project.station_number` í gegnum props eða context (sama pattern og `api`).

### 4.4 Ritstýring á stöðvar-númeri

Í `ProjectView` (eða project settings svæði) verður nýtt `Input` sem les/skrifar `project.station_number`. Þegar notandi breytir → `setProject({ ...project, station_number: newValue })` → `useAutoCommit` vistar 30s síðar eins og aðrar breytingar.

Þar sem `Bay.station` er horfinn verður engin sync-þörf — allir staðir lesa beint úr project state, svo breytingin sést strax í UI og er vistuð í einu commit-i.

## 5. UI breytingar

### 5.1 NewProject step 1
```
┌──────────────────────────────────────┐
│ Heiti dreifistöðvar / stöðvar        │
│ [t.d. Hamrahlíð 66kV              ]  │
│                                      │
│ Stöðvar númer                        │
│ [t.d. 55                          ]  │
│                                      │
│               [Hætta við] [Áfram →]  │
└──────────────────────────────────────┘
```

- Bæði required
- Áfram-takki disabled þar til bæði útfyllt
- Station number input: `inputMode="numeric"` + regex filter (`/^\d*$/`) svo notandi getur ekki slegið inn bókstafi
- Villuskeyti ef tómt eða ekki-tölustafir

### 5.2 ProjectView header / settings
- Stöðvar-númer sýnt við hlið verkefnis-heitis
- Ritstýranlegt (inline edit eða í settings modal — veljum einfaldari í implementation plan)

## 6. Próf

### 6.1 Unit tests (`projectService.test.ts`)
- `createProject` vistar `station_number` í `project.json`
- `createProject` hafnar tómu `stationNumber`
- `createProject` hafnar `stationNumber` með bókstöfum (eða: UI kemur í veg fyrir það og service treystir inputi — ákveðið í implementation)

### 6.2 Component tests (`NewProject.test.tsx`)
- Áfram-takki disabled ef station number autt
- Áfram-takki disabled ef nafn autt
- Aðeins tölustafir komast í station number input

### 6.3 Smoke test (manual)
1. Búa til nýtt verkefni með heiti + stöðvar-númer
2. Opna verkefnið — númer sést í header
3. Búa til nýjan reit — engin station input (er fjarlægður)
4. Breyta stöðvar-númeri í settings
5. Endurhlaða — nýtt gildi varðveitt

## 7. Gagna flutningur

Enginn migration kóði. Notandi eyðir núverandi verkefnum í `merkjalisti-data` áður en breytingin fer í framleiðslu.

Athugasemd: `loadProject` mun henda runtime error ef verkefni vantar `station_number` field. Það er viljandi — hljóð bilun væri verri en skýr villa. Ef þetta reynist óþægilegt má bæta við default `''` fallback en þá þarf UI að þola autt gildi.

## 8. Áhætta og mótvægi

| Áhætta | Mótvægi |
|---|---|
| Óuppgötvaðir staðir sem lesa `bay.station` | Grep-leit + TypeScript compiler finnur allar notkunir þegar field er fjarlægt |
| Gömul verkefni í produktion gagnasafni krassa | Notandi eyðir þeim fyrir deploy — staðfest í section 2 |
| Notandi slær inn of langa tölu | UI input hefur `maxLength={10}` (nóg fyrir öll raunveruleg númer) |

## 9. Áætluð task-skipting (fyrir writing-plans)

1. Uppfæra `Project` type með `station_number`
2. Uppfæra `createProject` service + test (TDD)
3. Uppfæra `NewProject.tsx` UI með nýjum reit + validation
4. Fjarlægja `Bay.station` og `BayTemplate.station`, laga allar notkunir (compiler-driven)
5. Bæta ritstýringu á station_number í ProjectView
6. Smoke test + build verification
