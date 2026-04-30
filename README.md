# Merkjalisti

Vefforrit fyrir IEC 61850 merkjalistar í rafvirkjum. Hannað fyrir GridTech Consulting Services til að halda utan um merkjalistar, stöður, sniðmát og útflutning á zenon SCADA kerfi.

**Slóð:** https://gridtech-is.github.io/merkjalisti/

---

## Aðgangur

Appið notar GitHub til að geyma gögn. Til að fá aðgang þarftu:

### 1. GitHub notendaaðgangur

Biðja Theodór (theodor@gridtech.is) um aðgang að gagnageymslunni `gridtech-is/merkjalisti-data` á GitHub.

### 2. GitHub Personal Access Token

1. Fara á https://github.com/settings/tokens
2. Smella **Generate new token (classic)**
3. Gefa token-inum nafn, t.d. `merkjalisti`
4. Velja scope: **`repo`**
5. Smella **Generate token**
6. **Afrita token-inn** — hann birtist aðeins einu sinni

### 3. Setja upp appið

1. Opna https://gridtech-is.github.io/merkjalisti/
2. Innskráningargluggi opnast sjálfkrafa
3. Líma token-inn í reitinn **GitHub Personal Access Token**
4. Reitirnir **GitHub Owner** (`gridtech-is`) og **Gagnageymsla** (`merkjalisti-data`) eru fyltir út fyrir
5. Smella **Tengjast**

---

## Uppbygging

- **App repo:** https://github.com/gridtech-is/merkjalisti — React SPA, GitHub Pages
- **Gagnageymsla:** https://github.com/gridtech-is/merkjalisti-data — JSON gögn, eitt commit per vistun

Öll gögn eru geymd í `gridtech-is/merkjalisti-data`:
```
data/signal_library.json       — merkjasafn
data/signal_states.json        — stöðulýsingar
data/equipment_templates.json  — búnaðarsniðmát
projects/{uuid}/               — verkefnagögn
```

---

## Þróun

```bash
git clone https://github.com/gridtech-is/merkjalisti.git
cd merkjalisti
npm install
npm run dev        # http://localhost:5173/merkjalisti/
npm run build      # tsc + vite build
npm test           # Vitest
```

GitHub token þarf að setja inn í appið í vafra eftir að `npm run dev` er keyrt.
