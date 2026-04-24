# Merkjalisti — SaaS Product Design

## Goal

Transform Merkjalisti from a personal GitHub-based tool into a sellable cloud SaaS where utility companies like Landsnet can purchase access. The system must be secure, auditable, and straightforward to operate as a service.

---

## Core Workflow

The primary use case is a **utility company** (e.g. Landsnet) that hires **contractors** to build and maintain IEC 61850 signal lists for substation projects. Contractors do the work; the utility owns the data and reviews it.

```
Utility (Landsnet)
  ├── owns all data
  ├── assigns contractors to projects
  ├── reviews and approves signal lists
  └── can revoke contractor access at any time

Contractors (Efla, Verkís, foreign firms, ...)
  ├── fill in signals, IEC 61850 mappings, bay data
  ├── can only see projects they are assigned to
  ├── cannot delete data
  └── submit work for review → utility approves
```

---

## Architecture

### Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | React 18 + TypeScript + Vite (unchanged) | No need to rewrite UI |
| Hosting | Vercel | Simple deploy, CDN, edge functions |
| Database | Supabase (PostgreSQL) | Auth + DB + Storage in one package, self-hostable |
| Auth | Supabase Auth | MFA, SSO/SAML, JWT |
| File storage | Supabase Storage | IED model files (ICD/SCD/IID) |
| Edge/CDN | Cloudflare | DDoS, IP rules, WAF |
| i18n | react-i18next | Icelandic + English (extensible) |

### Multi-tenancy

Each utility company is an **organization**. All data is scoped to an organization via PostgreSQL Row Level Security (RLS) — a user can never query data belonging to another organization, even if they craft a direct API request.

```
organizations
  └── projects
        └── bays
              └── signals
        └── equipment
  └── users (with roles)
  └── ip_allowlist
  └── audit_log
```

---

## Roles and Permissions

### Role Model

| Role | Who | Can do |
|------|-----|--------|
| **Owner** | Utility IT admin | Everything + billing + delete org |
| **Admin** | Utility project manager | Invite users, set IP rules, manage contractors, export |
| **Reviewer** | Utility engineer | Read all, approve/reject submissions (YFIRFERÐ → LÆST) |
| **Contractor** | External contractor | Edit assigned projects only, submit for review, no delete |
| **Viewer** | Utility stakeholder | Read only, download Excel |

### Contractor Isolation

- A contractor is **assigned to specific projects** — they cannot see other projects in the organization
- Contractor A from company X cannot see Contractor B from company Y, even if both work for the same utility
- Contractors can **edit and submit** but cannot approve, lock, or delete
- When a contractor is removed from a project, access is revoked immediately

### Review Workflow (already built)

The existing phase system maps directly to users:

```
DESIGN  →  YFIRFERÐ  →  LÆST  →  FAT  →  SAT
  ↑             ↑           ↑
contractor   contractor   reviewer
submits      flags        approves
```

Each transition is recorded in the audit log with the user who triggered it.

---

## Security

### 1. Authentication

- **Email + password** with MFA (TOTP / authenticator app)
- **MFA enforced** — organization admin can require MFA for all users (recommended for contractors)
- **SSO/SAML** — for utilities with Active Directory (Landsnet likely uses AD)
- **Session timeout** — configurable per organization (e.g. 8 hours)
- **Single session** — optionally limit to 1 active session per user (prevents credential sharing among contractors)

### 2. IP Allowlist

Each organization can define a list of allowed IP addresses or ranges (CIDR):

```
organization_ip_allowlist:
  - 193.4.x.x/24        ← Landsnet office network
  - 185.x.x.x           ← Landsnet VPN exit node
```

**How it works:**
- Cloudflare Worker or Supabase Edge Function checks `X-Forwarded-For` on every request
- If IP is not on the allowlist → 403, user receives a clear message
- IP rules are applied **per role** — Reviewers and Admins may require IP allowlist, Contractors may not (they work from sites, home, abroad)
- Exception: password reset emails bypass IP check (configurable)

### 3. Audit Log

Every data change is recorded:

```sql
audit_log:
  id              uuid
  organization_id uuid
  user_id         uuid
  user_email      text
  action          text        -- CREATE / UPDATE / DELETE / APPROVE / SUBMIT
  resource_type   text        -- project / bay / signal / equipment / ...
  resource_id     uuid
  old_value       jsonb
  new_value       jsonb
  ip_address      inet
  user_agent      text
  timestamp       timestamptz
```

- Admin and Reviewer can browse the audit log in the UI
- Filterable by user, project, date range, action type
- Exportable as CSV
- Retained for 2 years (configurable)
- Immutable — nobody can delete audit records, not even Owner

This answers the key question: *"Which contractor changed this signal, when, and what was there before?"*

### 4. Data Security

- **At rest:** Supabase encrypts all data on disk (AES-256)
- **In transit:** TLS 1.3 everywhere — Vercel, Supabase, Cloudflare
- **RLS:** PostgreSQL Row Level Security — every query is automatically filtered by `organization_id` from the JWT token. Even a direct database connection cannot read another org's data.
- **Secrets:** No secrets in code — environment variables on Vercel/Supabase only
- **File uploads:** IED model files stored in private Supabase Storage buckets, signed URLs with expiry

### 5. Network Security

- **Cloudflare WAF** — blocks common attack patterns (SQLi, XSS, path traversal)
- **DDoS protection** — Cloudflare Pro/Business plan
- **HTTPS only** — HSTS headers, HTTP redirected to HTTPS everywhere
- **CSP headers** — Content Security Policy on all pages
- **CORS** — only Merkjalisti domains allowed on Supabase API

### 6. API Rate Limiting

- Global: 100 requests / 10 seconds per user
- Login endpoint: 10 attempts / minute per IP → 15 min lockout
- File uploads: 10 / hour per user
- Integration API keys: separate limit per key

---

## Internationalization (i18n)

The app is currently 100% Icelandic. Foreign contractors cannot use it.

**Plan:**
- `react-i18next` for all UI strings
- Two language files to start: `locales/is.json` and `locales/en.json`
- Language toggle in the top navigation (IS / EN)
- User language preference stored in profile, persists across sessions
- Default language determined by browser locale on first visit

**What needs translation:**
- All UI labels, buttons, error messages, confirmation dialogs
- Phase names (Hönnun / Design, Læst / Locked, etc.)
- Email notifications

**What does NOT need translation:**
- IEC 61850 field names (international standard, English by definition)
- Signal codes and technical identifiers
- Project names and bay names (user-entered data)

---

## Data Model (migration from GitHub JSON)

Current JSON files → PostgreSQL tables:

| Current | New |
|---------|-----|
| `projects/{uuid}/project.json` | `projects` table |
| `projects/{uuid}/bays/{id}.json` | `bays` table + `signals` JSONB column |
| `data/signal_library.json` | `signal_library` table (shared or per-org) |
| `data/equipment_templates/{uuid}.json` | `equipment_templates` table |
| `projects/{uuid}/ied_models/{id}.json` | Supabase Storage |
| `projects/{uuid}/changelog.json` | `changelog` table |

The existing changelog system maps directly — write to DB instead of JSON.

---

## Onboarding a New Customer

1. You create an organization for Landsnet in the admin panel
2. You send an invite link to their IT contact
3. They set up their admin account with MFA
4. They configure IP allowlist (their office network + VPN)
5. They invite their engineers as Reviewers
6. They invite contractors per project (contractor gets an email invite, sets up account with MFA)
7. You run the migration script to import their existing GitHub data
8. Contractors log in and see only their assigned projects

---

## Pricing Model (draft)

| Plan | Price | Includes |
|------|-------|---------|
| **Starter** | €200/month | 1 org, 5 users, 10 projects |
| **Professional** | €500/month | 1 org, unlimited users, unlimited projects, audit log, IP allowlist, SSO |
| **Enterprise** | Contract | Custom SLA, EU data residency guarantee, self-hosted option, priority support |

Landsnet would likely want **Professional** or **Enterprise**.

---

## Implementation Stages

### Stage 1 — Foundation
- Set up Supabase project (EU region — Frankfurt)
- Create schema + RLS policies
- Replace `GitHubApi` with `SupabaseApi` (same interface → UI unchanged)
- Auth pages (login, MFA setup, password reset)
- Deploy on Vercel with custom domain (merkjalisti.is or similar)

### Stage 2 — Multi-tenancy + Roles
- Organization management UI
- User invite flow (email invitations)
- RBAC permission enforcement
- Contractor project assignment
- Audit log UI

### Stage 3 — i18n
- `react-i18next` setup
- Translate all UI strings to English
- Language toggle in navigation

### Stage 4 — Security hardening
- IP allowlist enforcement (Cloudflare Worker)
- SSO/SAML integration
- Rate limiting
- Session controls (single session, timeout)

### Stage 5 — Migration tooling
- Script to read GitHub JSON and write to Supabase
- Used to migrate your own data
- Used for onboarding new customers

---

## Notes

- **Supabase is self-hostable** — if a customer wants on-premise later, possible with Supabase Enterprise without changing application code
- **GDPR:** Supabase EU region (Frankfurt) — data does not leave the EU
- **Uptime SLA:** Vercel + Supabase offer 99.9% SLA on paid plans
- **The biggest code change is replacing `GitHubApi`** — all UI components are unaffected
