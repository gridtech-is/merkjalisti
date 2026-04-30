# Zenon flipi — hönnunarskjal

**Dagsetning:** 2026-04-30

## Markmið

Bæta við sérstökum Zenon flipa í ProjectView þar sem notandi getur stillt zenon driver nafn og NetAddr per IED, og exportað beint þaðan. Þetta leysir vandann að `<NetAddr>0</NetAddr>` er alltaf 0 í útflutningi og driver nafn er harðkóðað.

---

## Gagnalíkan

Nýtt skjal per verkefni: `projects/{uuid}/zenon_config.json`

```json
{
  "driver_name": "IEC850",
  "net_addr": {
    "PROT1": 0,
    "CTRL1": 1,
    "MEAS1": 2
  }
}
```

- `driver_name` — nafn IEC 61850 driver í zenon (t.d. `IEC850`, `IEC850_2`)
- `net_addr` — IED nafn (`iec61850_ied`) → rásarnúmer (NetAddr) í zenon driver

Skjalið er valfrjálst — ef það er ekki til er `driver_name` sjálfgefið `"IEC850"` og `net_addr` tómt (NetAddr=0 fyrir alla).

### Týpa

```typescript
interface ZenonConfig {
  driver_name: string;
  net_addr: Record<string, number>;
}
```

---

## Viðmót — ZenonTab

Nýr flipi **"Zenon"** í ProjectView hliðarstiku, við hliðina á "Heildarlist" og "Stöðvarmerki".

### Skipulag

```
Driver nafn:  [ IEC850___________________ ]

IED            Reitur        NetAddr
PROT1          40C01-BCF1    [ 0 ]
CTRL1          40C01-QA1     [ 1 ]
MEAS1          40C02-QA1     [ 2 ]

[↓ zenon var]  [↓ zenon rema]    [Vista]
```

### Virkni

- IED listi fylltur sjálfkrafa úr öllum reitunum (Equipment með `category === 'ied'`)
- Ef IED hefur ekkert `ied_name` er hann sýndur en NetAddr reitur óvirkur
- NetAddr reitur er talnainnslátt (`type="number"`, min=0)
- **Vista** hnappur vistar `zenon_config.json` á GitHub (eitt commit)
- **↓ zenon var** og **↓ zenon rema** nota driver nafn og NetAddr map úr stillingum

---

## Tæknileg uppbygging

### Nýjar skrár

**`src/services/zenonConfigService.ts`**
- `loadZenonConfig(api, projectId)` → `{ data: ZenonConfig, sha: string | null }`
- `saveZenonConfig(api, projectId, config, sha)` → `string` (nýtt sha)
- Skráarslóð: `projects/{projectId}/zenon_config.json`
- Ef skjalið er ekki til: skilar `{ data: { driver_name: 'IEC850', net_addr: {} }, sha: null }`

**`src/components/ZenonTab.tsx`**
- Hlær `zenon_config.json` og allar bay skrár við mount
- Sýnir driver nafn input og IED töflu
- Vista hnappur: kallar `saveZenonConfig`
- Export hnappar: kallar `exportZenonAllBaysVariables` og `exportZenonAllBaysRematrix` með `driverName` og `netAddrMap`

### Breytingar á exportService.ts

`exportZenonXml` fær nýja færibreytu:
```typescript
exportZenonXml(
  signals: BaySignal[],
  signalStates: SignalState[],
  driverName: string,
  bayName: string,
  netAddrMap: Record<string, number> = {},
): string
```

`variableXml` notar `netAddrMap[sig.iec61850_ied ?? ''] ?? 0` í stað fastans `0`.

`exportZenonAllBaysVariables` og `exportZenonBayVariables` fá `netAddrMap` sem valkvæða færibreytu.

### Breytingar á ProjectView

- `ZenonConfig` týpa flutt inn
- "Zenon" bætt við flipalistann
- `<ZenonTab>` sýndur þegar Zenon flipi er valinn

---

## Utan sviðs

- Engar breytingar á `Equipment` eða `Project` týpunum
- Engin preview á XML innihaldi
- Engar breytingar á bay-stigi export hnöppum (þeir nota ennþá sjálfgefnar stillingar)
