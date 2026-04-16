// src/services/exportService.ts
import * as XLSX from 'xlsx';
import type { Bay, BaySignal } from '../types';

const HEADERS = [
  'Kóði',              // display_id_equipment_signal
  'Reitur',            // bay.display_id
  'Tæki',              // equipment_code
  'Merki',             // signal_name
  'Heiti (IS)',        // name_is
  'Heiti (EN)',        // name_en
  'Uppspretta',        // source_type
  'Alarm',             // is_alarm
  'Flokkur',           // alarm_class
  'Fasi bætt við',     // phase_added
  'FAT prófað',        // fat_tested
  'FAT af',            // fat_tested_by
  'FAT dagsetning',    // fat_tested_at
  'SAT prófað',        // sat_tested
  'SAT af',            // sat_tested_by
  'SAT dagsetning',    // sat_tested_at
  'IEC IED',           // iec61850_ied
  'IEC LD',            // iec61850_ld
  'IEC LN',            // iec61850_ln
  'IEC LN Prefix',     // iec61850_ln_prefix
  'IEC LN Inst',       // iec61850_ln_inst
  'IEC DO/DA',         // iec61850_do_da
  'IEC FC',            // iec61850_fc
  'IEC CDC',           // iec61850_cdc
  'IEC Dataset',       // iec61850_dataset
  'IEC RCB',           // iec61850_rcb
  'IEC Dataset Entry', // iec61850_dataset_entry
];

function signalRow(bayDisplayId: string, sig: BaySignal): (string | number | boolean)[] {
  const code = [bayDisplayId, sig.equipment_code, sig.signal_name].filter(Boolean).join('_');
  return [
    code,
    bayDisplayId,
    sig.equipment_code,
    sig.signal_name,
    sig.name_is,
    sig.name_en ?? '',
    sig.source_type,
    sig.is_alarm,
    sig.alarm_class ?? '',
    sig.phase_added,
    sig.fat_tested,
    sig.fat_tested_by ?? '',
    sig.fat_tested_at ? new Date(sig.fat_tested_at).toLocaleDateString('is-IS') : '',
    sig.sat_tested,
    sig.sat_tested_by ?? '',
    sig.sat_tested_at ? new Date(sig.sat_tested_at).toLocaleDateString('is-IS') : '',
    sig.iec61850_ied ?? '',
    sig.iec61850_ld ?? '',
    sig.iec61850_ln ?? '',
    sig.iec61850_ln_prefix ?? '',
    sig.iec61850_ln_inst ?? '',
    sig.iec61850_do_da ?? '',
    sig.iec61850_fc ?? '',
    sig.iec61850_cdc ?? '',
    sig.iec61850_dataset ?? '',
    sig.iec61850_rcb ?? '',
    sig.iec61850_dataset_entry ?? '',
  ];
}

export function exportBayToExcel(bay: Bay): void {
  const rows = bay.signals.map(s => signalRow(bay.display_id, s));
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  ws['!cols'] = [
    20, 12, 10, 16, 36, 36, 12, 8, 8, 10,
    10, 14, 14, 10, 14, 14,
    14, 10, 10, 12, 10, 16, 6, 10, 16, 16, 18,
  ].map(w => ({ wch: w }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, bay.display_id.substring(0, 31));
  XLSX.writeFile(wb, `${bay.display_id}-merki.xlsx`);
}

export function exportAllBaysToExcel(bays: Bay[], projectName: string): void {
  const allRows = bays.flatMap(bay => bay.signals.map(s => signalRow(bay.display_id, s)));
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...allRows]);
  ws['!cols'] = [
    20, 12, 10, 16, 36, 36, 12, 8, 8, 10,
    10, 14, 14, 10, 14, 14,
    14, 10, 10, 12, 10, 16, 6, 10, 16, 16, 18,
  ].map(w => ({ wch: w }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Merki');
  XLSX.writeFile(wb, `${projectName}-merkjalisti.xlsx`);
}
