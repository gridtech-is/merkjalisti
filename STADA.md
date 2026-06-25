# Staða — Merkjalisti útgáfur

> Síðast uppfært: 2026-06-25

## ⚠️ Hvaða útgáfa er virk?

**V2 er virka útgáfan. Notið V2. V1 er gömul/óvirk.**

| | **V1 — gömul/óvirk** | **V2 — VIRK (aðal)** |
|---|---|---|
| Slóð | `C:\Users\TheodorJónsson\Desktop\Merkjalisti\merkjalisti` | `C:\Users\TheodorJónsson\Desktop\merkjalisti-v2` |
| GitHub | `gridtech-is/merkjalisti` | `gridtech-is/merkjalisti-v2` |
| Stack | GitHub Pages, gögn í `merkjalisti-data` repo | Supabase + Vercel |
| Vefur | GitHub Pages | `https://merkjalistiriotinto.vercel.app/` |
| Git-vinnulag | beint á `main` | feature branch + Pull Request |

**Regla:** Öll ný virkni á að fara í **V2**. Ekki breyta V1 nema það sé sérstaklega beðið um.

V2 er endurskrif (rewrite) á V1 yfir á Supabase + Vercel. Sami grunnur (React + TypeScript + Vite), sama gagnalíkan (`Equipment`, `IedFcda`, o.s.frv.), en gögn í Supabase í stað GitHub-repos.

## Hvað var gert 2026-06-25 — SCD merki-innflutningur

Bætt við virkni í **Tæki → IED → „↑ Innflytja SCD skrá"**:

1. **Módel per lið** — SCD-innflutningur vistar nú `IedFcda[]` módel fyrir hvern lið (eins og þegar ICD er hlaðið inn fyrir hvern lið).
2. **Uppfæra eða bæta við** — parar IED-nafn úr SCD við Tech key (`equipment.code`): uppfærir lið sem er til, annars bætir nýjum við.
3. **Nýtt / Uppfærir** — glugginn sýnir hvað verður nýtt og hvað uppfært áður en flutt er inn.
4. **(Aðeins V2)** — IP-tölur dregnar úr SCD `<Communication>` og settar í Zenon config.

### Staða innleiðingar
- **V1:** útfært og pushað beint á `main` (6 commits). _(Gert fyrir misskilning — V1 er ekki virka útgáfan.)_
- **V2:** portað á branch `feature/scd-merki-innflutningur` → **Pull Request #8**, bíður yfirferðar/merge.
  - Hönnun/plan: `docs/superpowers/specs/` + `docs/superpowers/plans/2026-06-25-scd-merki-innflutningur-v2.md`
  - `npm run build` ✅, `npm run test` ✅ (200 próf)
