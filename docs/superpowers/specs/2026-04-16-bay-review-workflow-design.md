# Bay Review Workflow — Design Spec

**Dagsetning:** 2026-04-16  
**Höfundur:** Teddi / GridTech

---

## Markmið

Bæta við yfirferðar- og læsingarferli á reit-stigi. Verktaki klárar reit, sendir í yfirferð, yfirferðarmaður samþykkir eða hafnar (með athugasemdum per merki), og loksins er reiturinn læstur. Ef breyting er gerð eftir læsingu hoppar reiturinn sjálfkrafa aftur í DRAFT.

---

## Gagnalíkan

### Ný type: `BayStatus`

```typescript
export type BayStatus = 'DRAFT' | 'IN_REVIEW' | 'LOCKED';
```

### Uppfært `Bay` interface

```typescript
export interface Bay {
  // ...núverandi reiti óbreyttir...
  status: BayStatus;        // sjálfgefið 'DRAFT' — migration: skortir → 'DRAFT'
  review: BayReview | null; // síðasta yfirferðarfærsla
}

export interface BayReview {
  sent_by: string;           // hver sendi í yfirferð
  sent_at: string;           // hvenær sent
  reviewed_by: string | null;
  reviewed_at: string | null;
  status: 'OPEN' | 'APPROVED' | 'REJECTED';
  comment: string | null;
}
```

### Uppfært `BaySignal` interface

```typescript
export interface BaySignal {
  // ...núverandi reiti óbreyttir...
  review_flagged: boolean;        // flaggað í yfirferð — migration: skortir → false
  review_comment: string | null;  // athugasemd yfirferðarmanns — migration: skortir → null
}
```

### Migration

Þegar `Bay` er lesinn án `status` → túlka sem `'DRAFT'`.  
Þegar `BaySignal` er lesinn án `review_flagged` → túlka sem `false`.  
Þegar `BaySignal` er lesinn án `review_comment` → túlka sem `null`.  
Migration er inline á lestrartíma — engin sérstök migration-skrá þarf.

---

## Verkflæði

```
DRAFT → IN_REVIEW → LOCKED
                ↘ DRAFT (hafnað)
LOCKED → DRAFT  (ef breyting gerð)
```

1. **DRAFT** — Verktaki breytir reit frjálslega.
2. **IN_REVIEW** — Reitur læstur fyrir verktaka. Yfirferðarmaður getur flaggað merki, bætt við merki, og samþykkt eða hafnað.
3. **LOCKED** — Reitur læstur (mjúk læsing). Ef breyting er gerð hoppar í DRAFT og yfirferðarathugasemdir hreinsast.
4. **Hafnað** → fer beint í DRAFT með athugasemdir sýnilegar inline.

---

## BayView — þrír hamur

### DRAFT

- Allt virkt eins og núna.
- Header sýnir gult **DRAFT** merki.
- Nýr takki: **"Senda í yfirferð"** — kallar á `sendBayForReview()`, breytir `status → 'IN_REVIEW'`, vistar.

### IN_REVIEW

- Allir breytingartakkar óvirkir: `+ Bæta við merki`, `↑ Innflutningur`, `Vista núna`, `↓ Excel`, `⊕ Sniðmát`, FAT/SAT tökkunum.
- Header sýnir blátt **Í YFIRFERÐ** merki með: "Sent af [notandi] [dagsetning]".
- Yfirferðarmaðurinn sér viðbótartakka í header:
  - **"Samþykkja"** → `status → 'LOCKED'`, vistar `bay.review` með `status: 'APPROVED'`
  - **"Hafna"** → opnar glugga fyrir athugasemd → `status → 'DRAFT'`, vistar `bay.review` með `status: 'REJECTED'`
- Per-merki í töflunni: lítill **"💬 Flagga"** takki í nýjum dálki lengst til hægri.
  - Smellt → opnar inline textareit fyrir athugasemd → vistar `review_flagged: true` og `review_comment`.
  - Yfirferðarmaður getur líka bætt við nýjum merkjum (SignalPickerModal virkt fyrir yfirferðarmann).

### LOCKED

- Header sýnir grænt **LÆST** merki með: "Samþykkt af [notandi] [dagsetning]".
- Allar breytingar teknilega mögulegar — en þegar breyting er vistuð:
  - `status → 'DRAFT'`
  - Öll `review_flagged` → `false`, `review_comment` → `null` á öllum merkjum.
  - Changelog skráir: `type: 'PHASE_CHANGED'`, `comment: 'Reitur opnaður aftur eftir læsingu'`.

### Flaggaðar merkjalínur

- Línur þar sem `review_flagged === true` fá **rauðan bakgrunn**.
- Nýr dálkur lengst til hægri í töflunni: 💬 tákn ef `review_comment` er til.
- Smellt á 💬 → tooltip/popup sýnir texta athugasemdarinnar.
- Verktaki getur hreinsað flag eftir lagfæringu: smellir á 💬 → "Hreinsa" takki.

---

## ProjectView — Reitir fáni

### Stöðu-merki í reitarlístu

Hvert reitarkort/-lína sýnir stöðu-merki:
- 🟡 **DRAFT** (gult)
- 🔵 **Í YFIRFERÐ** (blátt)
- 🟢 **LÆST** (grænt)

### Takkar í header

- **"Senda alla í yfirferð"** — sendir alla DRAFT reiti í yfirferð í einu. Staðfestingargluggi: "Senda X reiti í yfirferð?"
- Í hverri reitarlínu: lítill **"→ Yfirferð"** takki (sýnilegur aðeins þegar `status === 'DRAFT'`).

### Heildar-staða

Ef allir reitir eru LOCKED → verkefni sýnir "Allt læst ✓" í header (upplýsingalegur merki einungis — breytir ekki `ProjectPhase`).

---

## Þjónustur (services)

### `bayService.ts` — nýjar aðgerðir

```typescript
// Senda reit í yfirferð
export async function sendBayForReview(
  api: GitHubApi,
  projectId: string,
  bayFile: BayFile,
  sentBy: string
): Promise<BayFile>

// Samþykkja yfirferð
export async function approveBay(
  api: GitHubApi,
  projectId: string,
  bayFile: BayFile,
  reviewedBy: string,
  comment: string | null
): Promise<BayFile>

// Hafna yfirferð
export async function rejectBay(
  api: GitHubApi,
  projectId: string,
  bayFile: BayFile,
  reviewedBy: string,
  comment: string
): Promise<BayFile>
```

Allar þessar aðgerðir kalla á `appendChange()` til að skrá í changelog.

---

## Skrár sem breytast

| Skrá | Breyting |
|------|----------|
| `src/types.ts` | `BayStatus`, `BayReview`, uppfæra `Bay` og `BaySignal` |
| `src/services/bayService.ts` | `sendBayForReview`, `approveBay`, `rejectBay` |
| `src/pages/BayView.tsx` | Þrír hamur, flagging UI, review takkar |
| `src/pages/ProjectView.tsx` | Stöðu-merki í reitarlístu, bulk-send takki |

---

## Utan sviðs

- Tilkynningar (email/push) — kemur seinna.
- Aðgangsstýring (roles) — yfirferðarmaðurinn er hvaða notandi sem er með aðgang.
- Per-merki endurskoðunarferill — ein athugasemd per merki (ekki þráður).
