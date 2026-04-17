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
  name: string;         // IED@name  (IEC 61850 IED name, e.g. "Q0IED")
  desc: string;         // IED@desc
  manufacturer: string; // IED@manufacturer
  model: string;        // IED@type
  lds: ScdLd[];
}

export interface ScdParseResult {
  ieds: ScdIed[];
  errors: string[];
}

// ─── DataTypeTemplates index ───────────────────────────────────────────────

interface LnTypeEntry { lnClass: string; doRefs: Array<{ name: string; typeId: string }> }
interface DoTypeEntry { cdc: string; das: Array<{ name: string; fc: string }> }

function buildDtIndex(doc: Document): {
  lnTypes: Map<string, LnTypeEntry>;
  doTypes: Map<string, DoTypeEntry>;
} {
  const lnTypes = new Map<string, LnTypeEntry>();
  const doTypes = new Map<string, DoTypeEntry>();

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
    dot.querySelectorAll('DA').forEach(daEl => {
      das.push({ name: daEl.getAttribute('name') ?? '', fc: daEl.getAttribute('fc') ?? '' });
    });
    doTypes.set(id, { cdc, das });
  });

  return { lnTypes, doTypes };
}

// Interesting FCs — skip internal/config ones by default
const INTERESTING_FC = new Set(['ST', 'MX', 'CO', 'SP', 'SV', 'EX']);

function resolveDoDas(lnTypeId: string, dt: ReturnType<typeof buildDtIndex>): ScdDoDa[] {
  const lnType = dt.lnTypes.get(lnTypeId);
  if (!lnType) return [];

  const result: ScdDoDa[] = [];
  for (const doRef of lnType.doRefs) {
    const doType = dt.doTypes.get(doRef.typeId);
    if (!doType) continue;
    for (const da of doType.das) {
      if (!INTERESTING_FC.has(da.fc)) continue;
      result.push({ doName: doRef.name, daName: da.name, fc: da.fc, cdc: doType.cdc });
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
      lds,
    });
  });

  if (ieds.length === 0) errors.push('Engin IED fannst í skránni.');

  return { ieds, errors };
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
