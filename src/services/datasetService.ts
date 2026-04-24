// src/services/datasetService.ts
import type { BaySignal, IedFcda } from '../types';

const SCL_NS = 'http://www.iec.ch/61850/2003/SCL';

function mkEl(doc: Document, tag: string, attrs: Record<string, string>): Element {
  // Use document namespace if set, else no namespace
  const ns = doc.documentElement.namespaceURI ?? SCL_NS;
  const el = doc.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function insertDataSetsIntoIcd(
  xmlText: string,
  signals: BaySignal[],
  iedCode: string
): string | null {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) return null;

  // Find target IED element
  const allIeds = Array.from(doc.querySelectorAll('IED'));
  const targetIed = allIeds.find(el => el.getAttribute('name') === iedCode) ?? allIeds[0];
  if (!targetIed) return null;

  const ln0 = targetIed.querySelector('LN0');
  if (!ln0) return null;
  const ldInst = ln0.closest('LDevice')?.getAttribute('inst') ?? '';

  // Group eligible signals by dataset name
  const eligible = signals.filter(
    s => s.iec61850_ld && s.iec61850_ln && s.iec61850_do && s.iec61850_fc && s.iec61850_dataset && s.iec61850_dataset !== 'N/A'
  );
  const byDs = new Map<string, BaySignal[]>();
  for (const s of eligible) {
    const ds = s.iec61850_dataset!;
    if (!byDs.has(ds)) byDs.set(ds, []);
    byDs.get(ds)!.push(s);
  }
  if (byDs.size === 0) return null;

  // Remove existing elements with same names (idempotent)
  const dsNames = new Set(byDs.keys());
  const rcbNames = new Set<string>();
  for (const sigs of byDs.values()) {
    const rcb = sigs.find(s => s.iec61850_rcb)?.iec61850_rcb;
    if (rcb) rcbNames.add(rcb);
  }
  Array.from(ln0.querySelectorAll('DataSet')).forEach(el => {
    if (dsNames.has(el.getAttribute('name') ?? '')) el.remove();
  });
  Array.from(ln0.querySelectorAll('ReportControl')).forEach(el => {
    if (rcbNames.has(el.getAttribute('name') ?? '')) el.remove();
  });

  // Insertion points: DataSets before first RCB; new RCBs after last existing RCB
  const firstRcb = ln0.querySelector('ReportControl');
  let lastRcbChild: Element | null = null;
  for (const child of Array.from(ln0.children)) {
    if ((child.localName ?? child.tagName) === 'ReportControl') lastRcbChild = child;
  }
  // afterLastRcb is the node immediately after the last existing RCB (e.g. DOI, Inputs)
  // insertBefore(el, null) is equivalent to appendChild — so this handles all cases
  const rcbInsertBefore: ChildNode | null = lastRcbChild ? lastRcbChild.nextSibling : null;

  // Add DataSet elements
  for (const [dsName, sigs] of byDs) {
    const dsEl = mkEl(doc, 'DataSet', { name: dsName });
    const seen = new Set<string>();
    for (const s of sigs) {
      const key = `${s.iec61850_ld}|${s.iec61850_ln_prefix ?? ''}|${s.iec61850_ln}|${s.iec61850_ln_inst ?? '1'}|${s.iec61850_do}|${s.iec61850_da ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const attrs: Record<string, string> = {
        ldInst: s.iec61850_ld!,
        lnClass: s.iec61850_ln!,
        lnInst: s.iec61850_ln_inst ?? '1',
        doName: s.iec61850_do!,
        fc: s.iec61850_fc!,
      };
      if (s.iec61850_ln_prefix) attrs.prefix = s.iec61850_ln_prefix;
      if (s.iec61850_da) attrs.daName = s.iec61850_da;
      dsEl.appendChild(mkEl(doc, 'FCDA', attrs));
    }
    firstRcb ? ln0.insertBefore(dsEl, firstRcb) : ln0.insertBefore(dsEl, rcbInsertBefore);
  }

  // Add ReportControl elements right after last existing RCB (before DOI/Inputs/etc.)
  for (const [dsName, sigs] of byDs) {
    const rcbName = sigs.find(s => s.iec61850_rcb)?.iec61850_rcb ?? `rcb${dsName}`;
    const isBuffered = sigs[0]?.iec61850_fc === 'ST';
    const rptID = `${iedCode}${ldInst}/LLN0.${rcbName}`;

    const rcbAttrs: Record<string, string> = {
      name: rcbName, rptID, datSet: dsName, confRev: '1',
      bufTime: isBuffered ? '500' : '100',
    };
    if (isBuffered) rcbAttrs.buffered = 'true';
    const rcbEl = mkEl(doc, 'ReportControl', rcbAttrs);

    rcbEl.appendChild(mkEl(doc, 'TrgOps', { dchg: 'true', qchg: 'false', dupd: 'false', gi: 'true' }));
    rcbEl.appendChild(mkEl(doc, 'OptFields', {
      seqNum: 'true', timeStamp: 'true', dataSet: 'true', reasonCode: 'true',
      configRef: 'false', bufOvfl: isBuffered ? 'true' : 'false', entryID: isBuffered ? 'true' : 'false',
    }));
    rcbEl.appendChild(mkEl(doc, 'RptEnabled', { max: '1' }));
    ln0.insertBefore(rcbEl, rcbInsertBefore);
  }

  return prettyXml(new XMLSerializer().serializeToString(doc));
}

function prettyXml(xml: string): string {
  const lines: string[] = [];
  let depth = 0;
  xml.replace(/>\s*</g, '>\n<').split('\n').forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('</')) {
      depth = Math.max(0, depth - 1);
      lines.push('  '.repeat(depth) + line);
    } else if (line.startsWith('<?') || line.startsWith('<!--') || line.endsWith('/>')) {
      lines.push('  '.repeat(depth) + line);
    } else if (line.startsWith('<') && !line.includes('</')) {
      lines.push('  '.repeat(depth) + line);
      depth++;
    } else {
      lines.push('  '.repeat(depth) + line);
    }
  });
  return lines.join('\n');
}

export interface DataSetResult {
  xml: string;
  included: number;
  excluded: number;
}

export interface DataSetResultFcda {
  xml: string;
  total: number;
}

const FC_DS: Record<string, string> = { ST: 'dsStatus', MX: 'dsMeasurements' };
const FC_RCB: Record<string, string> = { ST: 'rcbStatus01', MX: 'rcbMeas01' };

export function generateDataSetSCLFromFcdas(fcdas: IedFcda[], iedCode: string): DataSetResultFcda {
  if (fcdas.length === 0) return { xml: '', total: 0 };

  // Group by dataset name if present, else by FC
  const byDs = new Map<string, IedFcda[]>();
  for (const f of fcdas) {
    const key = f.dataset ?? FC_DS[f.fc] ?? `ds${f.fc}`;
    if (!byDs.has(key)) byDs.set(key, []);
    byDs.get(key)!.push(f);
  }

  const lines: string[] = [
    `<!-- DataSets og ReportControls fyrir IED: ${iedCode} -->`,
    `<!-- Setja inn í LLN0 í viðeigandi LogicalDevice í SCD/ICD skrá -->`,
    '',
  ];
  const rcbLines: string[] = [];
  let idx = 1;

  for (const [dsName, entries] of byDs) {
    const rcbName = FC_RCB[entries[0]?.fc ?? ''] ?? (dsName.startsWith('ds') ? `rcb${dsName.slice(2)}${String(idx).padStart(2, '0')}` : `rcb${dsName}`);
    const ldInst = entries[0]?.ldInst ?? '';
    const isBuffered = entries[0]?.fc === 'ST';
    const rptID = `${iedCode}${ldInst}/LLN0.${rcbName}`;

    lines.push(`<DataSet name="${dsName}">`);
    const seen = new Set<string>();
    for (const f of entries) {
      const key = `${f.ldInst}|${f.prefix}|${f.lnClass}|${f.lnInst}|${f.doName}|${f.daName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const prefixAttr = f.prefix ? ` prefix="${f.prefix}"` : '';
      const daAttr = f.daName ? ` daName="${f.daName}"` : '';
      lines.push(`  <FCDA ldInst="${f.ldInst}"${prefixAttr} lnClass="${f.lnClass}" lnInst="${f.lnInst}" doName="${f.doName}"${daAttr} fc="${f.fc}"/>`);
    }
    lines.push(`</DataSet>`);
    lines.push('');

    if (isBuffered) {
      rcbLines.push(`<ReportControl name="${rcbName}" rptID="${rptID}" datSet="${dsName}" confRev="1" bufTime="500" buffered="true">`);
    } else {
      rcbLines.push(`<ReportControl name="${rcbName}" rptID="${rptID}" datSet="${dsName}" confRev="1" bufTime="100">`);
    }
    rcbLines.push(`  <TrgOps dchg="true" qchg="false" dupd="false" gi="true"/>`);
    rcbLines.push(isBuffered
      ? `  <OptFields seqNum="true" timeStamp="true" dataSet="true" reasonCode="true" configRef="false" bufOvfl="true" entryID="true"/>`
      : `  <OptFields seqNum="true" timeStamp="true" dataSet="true" reasonCode="true" configRef="false" bufOvfl="false" entryID="false"/>`
    );
    rcbLines.push(`  <RptEnabled max="1"/>`);
    rcbLines.push(`</ReportControl>`);
    rcbLines.push('');
    idx++;
  }

  return { xml: [...lines, ...rcbLines].join('\n'), total: fcdas.length };
}

export function generateDataSetSCL(signals: BaySignal[], iedCode: string): DataSetResult {
  const eligible = signals.filter(
    s => s.iec61850_ld && s.iec61850_ln && s.iec61850_do && s.iec61850_fc && s.iec61850_dataset && s.iec61850_dataset !== 'N/A'
  );
  const excluded = signals.length - eligible.length;
  if (eligible.length === 0) return { xml: '', included: 0, excluded };

  // Group by dataset name
  const byDs = new Map<string, BaySignal[]>();
  for (const s of eligible) {
    const ds = s.iec61850_dataset!;
    if (!byDs.has(ds)) byDs.set(ds, []);
    byDs.get(ds)!.push(s);
  }

  const lines: string[] = [
    `<!-- DataSets og ReportControls fyrir IED: ${iedCode} -->`,
    `<!-- Setja inn í LLN0 í viðeigandi LogicalDevice í SCD/ICD skrá -->`,
    '',
  ];
  const rcbLines: string[] = [];

  for (const [dsName, sigs] of byDs) {
    // Build DataSet
    lines.push(`<DataSet name="${dsName}">`);
    const seen = new Set<string>();
    for (const s of sigs) {
      const key = `${s.iec61850_ld}|${s.iec61850_ln_prefix ?? ''}|${s.iec61850_ln}|${s.iec61850_ln_inst ?? '1'}|${s.iec61850_do}|${s.iec61850_da ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const prefixAttr = s.iec61850_ln_prefix ? ` prefix="${s.iec61850_ln_prefix}"` : '';
      const daAttr = s.iec61850_da ? ` daName="${s.iec61850_da}"` : '';
      lines.push(
        `  <FCDA ldInst="${s.iec61850_ld}"${prefixAttr} lnClass="${s.iec61850_ln}" lnInst="${s.iec61850_ln_inst ?? '1'}" doName="${s.iec61850_do}"${daAttr} fc="${s.iec61850_fc}"/>`
      );
    }
    lines.push(`</DataSet>`);
    lines.push('');

    // RCB name — use iec61850_rcb from first signal that has it
    const rcbName = sigs.find(s => s.iec61850_rcb)?.iec61850_rcb
      ?? (dsName.startsWith('ds') ? `brcb${dsName.slice(2)}01` : `rcb${dsName}`);

    // ldInst for rptID — from first signal
    const ldInst = sigs[0].iec61850_ld ?? '';

    // Determine buffered based on FC — ST = buffered, MX/others = unbuffered
    const dominantFc = sigs[0].iec61850_fc ?? '';
    const isBuffered = dominantFc === 'ST';

    const rptID = `${iedCode}${ldInst}/LLN0.${rcbName}`;

    if (isBuffered) {
      rcbLines.push(
        `<ReportControl name="${rcbName}" rptID="${rptID}" datSet="${dsName}" confRev="1" bufTime="500" buffered="true">`
      );
    } else {
      rcbLines.push(
        `<ReportControl name="${rcbName}" rptID="${rptID}" datSet="${dsName}" confRev="1" bufTime="100">`
      );
    }
    rcbLines.push(`  <TrgOps dchg="true" qchg="false" dupd="false" gi="true"/>`);
    if (isBuffered) {
      rcbLines.push(
        `  <OptFields seqNum="true" timeStamp="true" dataSet="true" reasonCode="true" configRef="false" bufOvfl="true" entryID="true"/>`
      );
    } else {
      rcbLines.push(
        `  <OptFields seqNum="true" timeStamp="true" dataSet="true" reasonCode="true" configRef="false" bufOvfl="false" entryID="false"/>`
      );
    }
    rcbLines.push(`  <RptEnabled max="1"/>`);
    rcbLines.push(`</ReportControl>`);
    rcbLines.push('');
  }

  return { xml: [...lines, ...rcbLines].join('\n'), included: eligible.length, excluded };
}
