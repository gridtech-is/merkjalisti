# Merkjalisti V2 — Supabase Migration Design

**Dagsetning:** 2026-05-07
**Staða:** Samþykkt

---

## Markmið

Búa til V2 af Merkjalista í nýju GitHub repo (`gridtech-is/merkjalisti-v2`) þar sem öll gögn eru geymd í Supabase PostgreSQL gagnagrunn í stað GitHub JSON skráa. Forritið keyrir á Vercel. Þetta er lágmarksútgáfa — einn notandi (admin) í fyrstu, með grunn fyrir multi-tenancy síðar.

**Lykilávinningur:**
- Heildar-listinn hleður í millisekúndum (ein SQL fyrirspurn) í stað 30+ GitHub API calls
- Engin GitHub token þörf fyrir notendur
- Admin approval workflow fyrir nýja notendur
- Grunnur til að selja sem SaaS seinna

---

## Scope (lágmarksútgáfa)

**Innifalið:**
- Fullt normalized gagnagrunn schema í Supabase
- `SupabaseApi` kemur í stað `GitHubApi` (sama interface)
- Supabase Auth með email + lykilorð
- Login síða
- Admin approval workflow (beiðni → email → samþykki → aðgangur)
- `/admin/users` og `/admin/projects` síður
- Migration script frá GitHub JSON → Supabase
- Deploy á Vercel með `merkjalisti.is` domain

**Ekki innifalið (V3 / SaaS):**
- Multi-tenancy (margar organizations)
- IP allowlist
- SSO/SAML
- Audit log UI
- i18n / enska þýðing
- Verðlag og billing

---

## Stack

| Lag | Tækni |
|-----|-------|
| Frontend | React 18 + TypeScript + Vite (óbreytt) |
| Hosting | Vercel |
| Gagnagrunnur | Supabase (PostgreSQL, EU Frankfurt) |
| Auth | Supabase Auth (email + lykilorð) |
| Skráageymsla | Supabase Storage (IED model skrár) |

---

## Gagnalíkan

### Töflur

```sql
-- Organizations (ein í fyrstu — Gridtech)
organizations (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now()
)

-- Projects
projects (
  id              uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations,
  name            text NOT NULL,
  station_number  text,
  display_id      text,
  description     text,
  status          text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)

-- Bays
bays (
  id           uuid PRIMARY KEY,
  project_id   uuid REFERENCES projects,
  name         text NOT NULL,
  display_id   text,
  description  text,
  status       text,
  sort_order   int DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
)

-- Signals (fullt normalized)
signals (
  id                      uuid PRIMARY KEY,
  bay_id                  uuid REFERENCES bays,
  signal_name             text,
  equipment_code          text,
  state_id                text,
  is_alarm                boolean DEFAULT false,
  alarm_class             int,
  group_label             text,
  notes                   text,
  iec61850_ied            text,
  iec61850_ld             text,
  iec61850_ln             text,
  iec61850_ln_inst        text,
  iec61850_ln_prefix      text,
  iec61850_do             text,
  iec61850_da             text,
  iec61850_fc             text,
  iec61850_cdc            text,
  iec61850_dataset        text,
  iec61850_rcb            text,
  iec61850_dataset_entry  text,
  sort_order              int DEFAULT 0,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
)

-- Equipment per project
equipment (
  id              uuid PRIMARY KEY,
  project_id      uuid REFERENCES projects,
  code            text,
  category        text,
  type            text,
  ied_name        text,
  manufacturer    text,
  model           text,
  config_version  text,
  template_id     uuid,
  description     text
)

-- Changelog per project
changelog (
  id          uuid PRIMARY KEY,
  project_id  uuid REFERENCES projects,
  user_id     uuid REFERENCES auth.users,
  action      text,
  description text,
  snapshot    jsonb,
  created_at  timestamptz DEFAULT now()
)

-- Signal library (deilt)
signal_library (
  id              uuid PRIMARY KEY,
  signal_name     text,
  description_is  text,
  description_en  text,
  iec61850_ln     text,
  iec61850_do     text,
  iec61850_da     text,
  iec61850_fc     text,
  iec61850_cdc    text,
  state_id        text,
  is_alarm        boolean,
  alarm_class     int,
  updated_at      timestamptz DEFAULT now()
)

-- Signal states (deilt)
signal_states (
  id          text PRIMARY KEY,
  states      jsonb,
  updated_at  timestamptz DEFAULT now()
)

-- Equipment templates (deilt)
equipment_templates (
  id          uuid PRIMARY KEY,
  name        text,
  signals     jsonb,
  updated_at  timestamptz DEFAULT now()
)

-- Station signals (per project — merki á stöðvarstig, ekki bay)
station_signals (
  id          uuid PRIMARY KEY,
  project_id  uuid REFERENCES projects,
  signals     jsonb,  -- array af BaySignal (sama format og signals taflan)
  updated_at  timestamptz DEFAULT now()
)

-- FAT/SAT testing data (per project)
testing (
  id          uuid PRIMARY KEY,
  project_id  uuid REFERENCES projects,
  data        jsonb,
  updated_at  timestamptz DEFAULT now()
)

-- Access requests
access_requests (
  id           uuid PRIMARY KEY,
  email        text NOT NULL,
  name         text NOT NULL,
  company      text,
  reason       text,
  status       text DEFAULT 'pending',  -- pending / approved / rejected
  role         text,                    -- útfyllt af admin við samþykki
  requested_at timestamptz DEFAULT now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid REFERENCES auth.users
)

-- User profiles + roles
user_profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users,
  email      text,
  name       text,
  company    text,
  role       text DEFAULT 'viewer',  -- admin / reviewer / contractor / viewer
  is_active  boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
)

-- Project assignments (hvaða notendur sjá hvaða verkefni)
project_members (
  project_id uuid REFERENCES projects,
  user_id    uuid REFERENCES auth.users,
  PRIMARY KEY (project_id, user_id)
)
```

### Heildar-listi fyrirspurn

```sql
SELECT s.*, b.display_id as bay_display_id, b.name as bay_name
FROM signals s
JOIN bays b ON b.id = s.bay_id
WHERE b.project_id = $1
ORDER BY b.sort_order, s.sort_order
```

Ein fyrirspurn — millisekúndur — í stað 30+ HTTP beiðna.

---

## Kóðabreytingar

### Nýtt repo: `gridtech-is/merkjalisti-v2`

Copy af `gridtech-is/merkjalisti` sem byrjunarpunktur. Breytingar:

```
src/
  supabase/
    client.ts        ← createClient() með env vars
    api.ts           ← SupabaseApi (kemur í stað GitHubApi)
    auth.ts          ← signIn, signOut, getSession, onAuthStateChange
  pages/
    Login.tsx        ← email + lykilorð form
    RequestAccess.tsx ← beiðni um aðgang
    admin/
      UsersPage.tsx  ← pending beiðnir + virkir notendur
      ProjectsPage.tsx ← úthluta notendum á verkefni
  services/
    migration.ts     ← GitHub JSON → Supabase (keyrt einu sinni)
```

**Eyða:**
- `src/github/` — allt
- `src/github/token.ts` — allt
- `src/components/TokenSetup.tsx` — allt
- `src/hooks/useAutoCommit.ts` — GitHub commit debounce, þarf ekki lengur

**Breyta:**
- `useAutoCommit` kallar → bein Supabase `UPSERT` án debounce (Supabase ræður við tíðar skrifanir)
- `src/context/LibraryContext.tsx` → les úr `signal_library` og `signal_states` töflum

**Supabase Storage:**
- Bucket `ied-models` (private) — geymir ICD/IID/SCD skrár
- Path: `{project_id}/{equipment_id}.json`
- Kemur í stað `projects/{uuid}/ied_models/{equipment.id}.json` í GitHub

**Óbreytt (snerta ekki):**
- `src/components/BayView.tsx`
- `src/components/SignalTable.tsx`
- `src/pages/OverviewTab.tsx`
- `src/services/exportService.ts`
- `src/types.ts`
- `src/context/LibraryContext.tsx` — uppfærir til að lesa úr Supabase

### SupabaseApi interface

`SupabaseApi` útfærir sömu aðgerðir og `GitHubApi`:

| GitHubApi | SupabaseApi |
|-----------|-------------|
| `readJson(path)` | `SELECT` |
| `writeJson(path, data)` | `UPSERT` |
| `deleteFile(path)` | `DELETE` |
| `listFiles(path)` | `SELECT` |

UI-ið kallar á sama interface — engar breytingar á components.

---

## Auth og notendastjórnun

### Innskráning

- `/login` síða — email + lykilorð
- Supabase Auth skilar JWT token
- Token vistað í Supabase session (ekki localStorage handvirkt)
- `onAuthStateChange` hook heldur session fersku

### Admin approval workflow

```
1. Notandi → /request-access
   Fyller inn: nafn, tölvupóst, fyrirtæki, ástæða

2. Supabase Edge Function sendir email á app@gridtech.is
   "Nýr aðgangsbeiðandi: [nafn] / [fyrirtæki]"
   Hlekkur beint á /admin/users

3. Admin → /admin/users
   Sér pending beiðni
   Velur role + verkefni
   Smellir "Samþykkja"

4. Kerfið:
   → Virkjar notandann í Supabase Auth (invite email)
   → Notandi fær email með link til að setja lykilorð
   → Skráir í access_requests (reviewed_at, reviewed_by)
   → Bætir í project_members ef verkefni valin
```

### Admin síður

Aðeins notendur með `role = 'admin'` sjá `/admin/*`:
- `/admin/users` — pending beiðnir, virkir notendur, breyta roles
- `/admin/projects` — úthluta notendum á verkefni

---

## Migration script

`src/services/migration.ts` — keyrt einu sinni af admin í developer console:

```typescript
async function migrateFromGitHub(githubToken: string) {
  // 1. Les signal_library.json og signal_states.json
  // 2. Les öll projects/{uuid}/project.json
  // 3. Les öll projects/{uuid}/bays/{id}.json
  // 4. Skrifar í Supabase í réttri röð (organizations → projects → bays → signals)
  // 5. Prentar skýrslu: X verkefni, Y bays, Z merki flutt
}
```

Keyrð einu sinni, eytt eftir að migration er staðfest.

---

## Vercel uppsetning

- Repo: `gridtech-is/merkjalisti-v2`
- `main` branch → production (`app.merkjalisti.is` eða `merkjalisti.is`)
- Hvert PR → preview URL sjálfkrafa
- Environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

---

## RLS (Row Level Security)

Einföld RLS í V2 — aðeins virkir notendur geta lesið/skrifað:

```sql
-- Dæmi fyrir signals
CREATE POLICY "Virkir notendur geta lesið merki"
ON signals FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND is_active = true
  )
);
```

Byggt til að taka við `organization_id` filter í V3 (SaaS útgáfu).

---

## Framkvæmdaröð

1. **Supabase** — búa til project (Frankfurt), keyra schema SQL, RLS policies
2. **Nýtt repo** — `gridtech-is/merkjalisti-v2`, copy af kóða
3. **Auth** — `SupabaseApi`, `auth.ts`, Login.tsx, RequestAccess.tsx
4. **Admin síður** — UsersPage.tsx, ProjectsPage.tsx, approval workflow
5. **LibraryContext** — uppfæra til að lesa úr Supabase
6. **Migration script** — skrifa, keyra, staðfesta gögn
7. **Vercel** — tengja repo, environment variables, domain
8. **Prófa** — heildar-listi hraði, auth flow, approval workflow

---

## Tenging við SaaS spec

Þessi V2 er Stage 1 úr `2026-04-23-saas-vidskiptavinir-design.md`. Þegar V2 er kominn í gang er grunnurinn til:
- Stage 2: Multi-tenancy + full RBAC
- Stage 3: i18n (enska)
- Stage 4: IP allowlist, SSO
