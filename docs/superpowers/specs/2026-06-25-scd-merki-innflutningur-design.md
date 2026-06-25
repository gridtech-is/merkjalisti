# SCD merki-innflutningur + uppfærsla liða

**Dagsetning:** 2026-06-25
**Staða:** Samþykkt hönnun — implementation plan næst

## Markmið

Þegar SCD skrá er flutt inn undir **Tæki → IED** á að:

1. **Flytja inn merki (módel) fyrir hvern lið** — `IedFcda[]` vistað í `ied_models/{equipment.id}.json`, nákvæmlega eins og gerist þegar ICD skrá er hlaðin inn fyrir hvern lið. Í dag bætir SCD-innflutningur **aðeins** við Equipment-röðum og vistar ekkert módel.
2. **Uppfæra lið sem er nú þegar til** ef Tech key (`equipment.code`) passar við IED-nafn úr SCD — frekar en að tvítaka hann.
3. **Sýna í glugganum** hvaða liðir verða *nýir* og hvaða verða *uppfærðir*, áður en flutt er inn.

## Bakgrunnur — núverandi flæði

- **ICD per-liða** (`ProjectView.handleUploadIcd`): les skrá → `parseModel(xmlText)` → `saveModel(...)` vistar `IedFcda[]` í `projects/{id}/ied_models/{equipment.id}.json`. Þetta eru „merkin fyrir liðann".
- **SCD** (`ImportScdModal` + `onAddEquipment`): les skrá → `parseScd(xmlText)` → `ScdIed[]` → býr til Equipment-raðir og kallar `onAddEquipment(items)`, sem aðeins gerir `saveEquipment([...equipment, ...items])`. **Ekkert módel vistað, engin pörun við lið sem er til.**

`ScdIed` inniheldur þegar uppleyst DO/DA, og `flattenIedModel(ied)` breytir `ScdIed` → `IedFcda[]`. Þannig má endurnýta sömu vistunarleið.

## Pörun

- Para IED-nafn úr SCD (`ied.name`) við **Tech key** (`equipment.code`) meðal tækja með `category === 'ied'`.
- Nákvæm, há-/lágstafanæm pörun. SCD-innflutningur setur `code = ied.name`, svo endur-innflutningur sömu skráar passar alltaf.
- Ekki para við `ied_name` né önnur svæði (ákvörðun notanda).

## Breytingar

### 1. `src/services/iedModelService.ts`

Nýtt hreint fall:

```ts
export function flattenIedModelWithDataSets(ied: ScdIed, xmlText: string): IedFcda[]
```

- Kallar `flattenIedModel(ied)`.
- Auðgar með `extractDataSets(xmlText, ied.name)` — sama DataSet-pörunarlógík og `parseModel` notar í dag (ldInst + lnClass + lnInst + prefix + doName + fc, með daName-sveigjanleika).
- `parseModel` endurskrifað til að nota þetta fall → ein uppspretta sannleika fyrir flatten + dataset-auðgun.

Þar með fær SCD-innflutningur **sömu merki, með dataset-nöfnum**, og ICD-per-liða gefur.

### 2. `src/components/ImportScdModal.tsx`

- Geyma `xmlText` í state (þarf til `extractDataSets`).
- Ný prop: `existingIeds: Equipment[]` (núverandi IED-tæki).
- Per IED-röð: reikna `existingId = existingIeds.find(e => e.code === ied.name)?.id ?? null` og sýna merki:
  - 🟢 **Nýtt** þegar `existingId === null`
  - 🟡 **Uppfærir** þegar Tech key passar
- Aðgerðahnappur: **„Flytja inn — N nýir, M uppfærðir"** (telur aðeins valda liði). Excel-hnappurinn helst óbreyttur.
- Skipta út `onAddEquipment(items)` fyrir:

```ts
onImport: (entries: Array<{
  ied: ScdIed;
  model: IedFcda[];
  existingId: string | null;
}>) => Promise<void>;
```

Glugginn byggir `model` per valinn lið með `flattenIedModelWithDataSets(ied, xmlText)`.

### 3. `src/pages/ProjectView.tsx` — `handleScdImport`

Fyrir hverja færslu:

- **Uppfærsla** (`existingId` til):
  - Patch á `manufacturer` / `model` / `config_version` úr SCD ef til staðar (eins og `handleUploadIcd` — snertir **ekki** `description` / `code` / `ied_name` / `template_id`).
  - `saveModel(api, projectId, existingId, model, ied.name)` skrifar yfir módelskrána.
- **Nýtt**:
  - Bý til Equipment (uuid, `code = ied_name = ied.name`, `manufacturer` / `model` / `config_version` úr SCD, `description = ied.desc`).
  - `saveModel(api, projectId, newId, model, ied.name)`.

Eftir lykkju: ein `saveEquipment(...)` vistun á `equipment.json` (öll uppfærð + ný í einu), og ein módelskrá per IED. Uppfæri `iedModels` state-kortið svo `✓ N merki` birtist strax. Skipti yfir á IED-flipann.

`ImportScdModal` fær `existingIeds={ieds}`.

## Próf

- Vitest fyrir `flattenIedModelWithDataSets`:
  - SCD með 2 IED-um → rétt IED flatt, dataset-nöfn auðguð á réttar FCDA-færslur, DA-sveigjanleiki virkar.
- `npm run build` + `npm test` græn áður en sagt er „búið".

## Umfang sem EKKI er snert

- Bay-merki breytast ekki (módel hefur aðeins áhrif á IEC-staðfestingu og FCDA-val).
- Excel-útflutningur óbreyttur.
- Engin önnur pörun en Tech key.

## Athugasemdir / málamiðlanir

- Hver módelskrá = eitt GitHub commit (núverandi mynstur). SCD með mörgum IED-um → mörg commits. Sætt til samræmis við ICD-leiðina.
- Tóm módel (`[]`) fyrir IED án DO/DA eru vistuð eins og ICD-leiðin gerir — saklaust, sýnir „✓ 0 merki".
