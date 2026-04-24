// src/services/scdParser.ts
// Parses an IEC 61850 SCD (System Configuration Description) XML file.
// Extracts IEDs, their Logical Devices, and Logical Node instances.
// Optionally resolves DO/DA details from DataTypeTemplates.

export interface ScdDoDa {
  doName: string;
  daName: string;
  fc: string;
  cdc: string;
}

export interface ScdLn {
  prefix: string;       // LN@prefix
  lnClass: string;      // LN@lnClass
  inst: string;         // LN@inst
  lnType: string;       // LN@lnType — used to look up DataTypeTemplates
  doDas: ScdDoDa[];     // resolved from DataTypeTemplates (may be empty)
}

export interface ScdLd {
  inst: string;         // LDevice@inst
  lns: ScdLn[];
}

export interface ScdIed {
  name: string;          // IED@name  (IEC 61850 IED name, e.g. "Q0IED")
  desc: string;          // IED@desc
  manufacturer: string;  // IED@manufacturer
  model: string;         // IED@type  (device type, e.g. "REC670")
  configVersion: string; // IED@configVersion
  lds: ScdLd[];
}

export interface ScdParseResult {
  ieds: ScdIed[];
  errors: string[];
}

// ─── DataTypeTemplates index ───────────────────────────────────────────────

interface LnTypeEntry { lnClass: string; doRefs: Array<{ name: string; typeId: string }> }
interface DoTypeEntry { cdc: string; das: Array<{ name: string; fc: string; bType: string; typeId: string }>; sdos: Array<{ name: string; typeId: string }> }
interface DaTypeEntry { bdas: Array<{ name: string; bType: string; typeId: string }> }

function buildDtIndex(doc: Document): {
  lnTypes: Map<string, LnTypeEntry>;
  doTypes: Map<string, DoTypeEntry>;
  daTypes: Map<string, DaTypeEntry>;
} {
  const lnTypes = new Map<string, LnTypeEntry>();
  const doTypes = new Map<string, DoTypeEntry>();
  const daTypes = new Map<string, DaTypeEntry>();

  doc.querySelectorAll('DataTypeTemplates > LNodeType').forEach(lnt => {
    const id = lnt.getAttribute('id') ?? '';
    const lnClass = lnt.getAttribute('lnClass') ?? '';
    const doRefs: LnTypeEntry['doRefs'] = [];
    lnt.querySelectorAll('DO').forEach(doEl => {
      doRefs.push({ name: doEl.getAttribute('name') ?? '', typeId: doEl.getAttribute('type') ?? '' });
    });
    lnTypes.set(id, { lnClass, doRefs });
  });

  doc.querySelectorAll('DataTypeTemplates > DOType').forEach(dot => {
    const id = dot.getAttribute('id') ?? '';
    const cdc = dot.getAttribute('cdc') ?? '';
    const das: DoTypeEntry['das'] = [];
    dot.querySelectorAll(':scope > DA').forEach(daEl => {
      das.push({
        name: daEl.getAttribute('name') ?? '',
        fc: daEl.getAttribute('fc') ?? '',
        bType: daEl.getAttribute('bType') ?? '',
        typeId: daEl.getAttribute('type') ?? '',
      });
    });
    const sdos: DoTypeEntry['sdos'] = [];
    dot.querySelectorAll(':scope > SDO').forEach(sdoEl => {
      sdos.push({ name: sdoEl.getAttribute('name') ?? '', typeId: sdoEl.getAttribute('type') ?? '' });
    });
    doTypes.set(id, { cdc, das, sdos });
  });

  doc.querySelectorAll('DataTypeTemplates > DAType').forEach(dat => {
    const id = dat.getAttribute('id') ?? '';
    const bdas: DaTypeEntry['bdas'] = [];
    dat.querySelectorAll(':scope > BDA').forEach(bdaEl => {
      bdas.push({
        name: bdaEl.getAttribute('name') ?? '',
        bType: bdaEl.getAttribute('bType') ?? '',
        typeId: bdaEl.getAttribute('type') ?? '',
      });
    });
    daTypes.set(id, { bdas });
  });

  return { lnTypes, doTypes, daTypes };
}

// Interesting FCs — skip internal/config ones by default
const INTERESTING_FC = new Set(['ST', 'MX', 'CO', 'SP', 'SV', 'EX']);

function expandDa(
  doName: string,
  daPrefix: string,
  fc: string,
  cdc: string,
  daTypeId: string,
  daTypes: Map<string, DaTypeEntry>,
  result: ScdDoDa[],
  depth: number,
): void {
  if (depth > 3) return;
  const daType = daTypes.get(daTypeId);
  if (!daType) return;
  for (const bda of daType.bdas) {
    const fullDa = daPrefix ? `${daPrefix}.${bda.name}` : bda.name;
    if (bda.bType === 'Struct' && bda.typeId) {
      expandDa(doName, fullDa, fc, cdc, bda.typeId, daTypes, result, depth + 1);
    } else {
      result.push({ doName, daName: fullDa, fc, cdc });
    }
  }
}

// Handles SDO (sub-data objects) in DOType — e.g. WYE.phsA → CMV.cVal.mag.f
function expandSdo(
  doName: string,
  sdoTypeId: string,
  dt: ReturnType<typeof buildDtIndex>,
  result: ScdDoDa[],
): void {
  const sdoType = dt.doTypes.get(sdoTypeId);
  if (!sdoType) return;
  for (const da of sdoType.das) {
    if (!INTERESTING_FC.has(da.fc)) continue;
    if (da.bType === 'Struct' && da.typeId) {
      expandDa(doName, da.name, da.fc, sdoType.cdc, da.typeId, dt.daTypes, result, 0);
    } else {
      result.push({ doName, daName: da.name, fc: da.fc, cdc: sdoType.cdc });
    }
  }
  for (const sdo of sdoType.sdos) {
    expandSdo(`${doName}.${sdo.name}`, sdo.typeId, dt, result);
  }
}

function resolveDoDas(lnTypeId: string, dt: ReturnType<typeof buildDtIndex>): ScdDoDa[] {
  const lnType = dt.lnTypes.get(lnTypeId);
  if (!lnType) return [];

  const result: ScdDoDa[] = [];
  for (const doRef of lnType.doRefs) {
    const doType = dt.doTypes.get(doRef.typeId);
    if (!doType) continue;
    for (const da of doType.das) {
      if (!INTERESTING_FC.has(da.fc)) continue;
      if (da.bType === 'Struct' && da.typeId) {
        expandDa(doRef.name, da.name, da.fc, doType.cdc, da.typeId, dt.daTypes, result, 0);
      } else {
        result.push({ doName: doRef.name, daName: da.name, fc: da.fc, cdc: doType.cdc });
      }
    }
    for (const sdo of doType.sdos) {
      expandSdo(`${doRef.name}.${sdo.name}`, sdo.typeId, dt, result);
    }
  }
  return result;
}

// ─── Main parser ───────────────────────────────────────────────────────────

export function parseScd(xmlText: string): ScdParseResult {
  const errors: string[] = [];
  const ieds: ScdIed[] = [];

  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlText, 'application/xml');
    const parseErr = doc.querySelector('parsererror');
    if (parseErr) throw new Error(parseErr.textContent ?? 'XML parse error');
  } catch (e) {
    return { ieds: [], errors: [`XML villa: ${e instanceof Error ? e.message : String(e)}`] };
  }

  const dt = buildDtIndex(doc);

  doc.querySelectorAll('IED').forEach(iedEl => {
    const name = iedEl.getAttribute('name') ?? '';
    if (!name) return;

    const lds: ScdLd[] = [];

    iedEl.querySelectorAll('LDevice').forEach(ldEl => {
      const ldInst = ldEl.getAttribute('inst') ?? '';
      const lns: ScdLn[] = [];

      // LN0
      ldEl.querySelectorAll('LN0').forEach(lnEl => {
        const lnType = lnEl.getAttribute('lnType') ?? '';
        lns.push({
          prefix: '',
          lnClass: 'LLN0',
          inst: '',
          lnType,
          doDas: resolveDoDas(lnType, dt),
        });
      });

      // LN
      ldEl.querySelectorAll('LN').forEach(lnEl => {
        const lnType = lnEl.getAttribute('lnType') ?? '';
        lns.push({
          prefix: lnEl.getAttribute('prefix') ?? '',
          lnClass: lnEl.getAttribute('lnClass') ?? '',
          inst: lnEl.getAttribute('inst') ?? '',
          lnType,
          doDas: resolveDoDas(lnType, dt),
        });
      });

      if (lns.length > 0) lds.push({ inst: ldInst, lns });
    });

    ieds.push({
      name,
      desc: iedEl.getAttribute('desc') ?? '',
      manufacturer: iedEl.getAttribute('manufacturer') ?? '',
      model: iedEl.getAttribute('type') ?? '',
      configVersion: iedEl.getAttribute('configVersion') ?? '',
      lds,
    });
  });

  if (ieds.length === 0) errors.push('Engin IED fannst í skránni.');

  return { ieds, errors };
}

// ─── DataSet extractor ────────────────────────────────────────────────────
// Reads <DataSet><FCDA> elements directly from the ICD/IID file.
// Returns one entry per FCDA, tagged with the DataSet name.

export interface ScdDataSetFcda {
  dataset: string;
  ldInst: string;
  prefix: string;
  lnClass: string;
  lnInst: string;
  doName: string;
  daName: string;
  fc: string;
}

export function extractDataSets(xmlText: string, iedName?: string): ScdDataSetFcda[] {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) return [];
  } catch { return []; }

  const result: ScdDataSetFcda[] = [];

  // Find the target IED element
  const all = Array.from(doc.querySelectorAll('IED'));
  let target: Element | null = null;
  if (iedName) target = all.find(el => el.getAttribute('name') === iedName) ?? null;
  if (!target) {
    // Fall back to IED with most LDevices
    target = all.reduce<Element | null>((best, el) =>
      !best || el.querySelectorAll('LDevice').length > best.querySelectorAll('LDevice').length ? el : best
    , null);
  }
  if (!target) return [];

  target.querySelectorAll('LDevice').forEach(ldEl => {
    // DataSets live in LN0
    ldEl.querySelectorAll('LN0 > DataSet').forEach(dsEl => {
      const dataset = dsEl.getAttribute('name') ?? '';
      dsEl.querySelectorAll('FCDA').forEach(fEl => {
        result.push({
          dataset,
          ldInst: fEl.getAttribute('ldInst') ?? '',
          prefix: fEl.getAttribute('prefix') ?? '',
          lnClass: fEl.getAttribute('lnClass') ?? '',
          lnInst: fEl.getAttribute('lnInst') ?? '',
          doName: fEl.getAttribute('doName') ?? '',
          daName: fEl.getAttribute('daName') ?? '',
          fc: fEl.getAttribute('fc') ?? '',
        });
      });
    });
  });

  return result;
}

// ─── Stats helper ─────────────────────────────────────────────────────────

export function scdStats(ieds: ScdIed[]): { iedCount: number; ldCount: number; lnCount: number; doDaCount: number } {
  let ldCount = 0, lnCount = 0, doDaCount = 0;
  for (const ied of ieds) {
    ldCount += ied.lds.length;
    for (const ld of ied.lds) {
      lnCount += ld.lns.length;
      for (const ln of ld.lns) doDaCount += ln.doDas.length;
    }
  }
  return { iedCount: ieds.length, ldCount, lnCount, doDaCount };
}
