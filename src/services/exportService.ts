// src/services/exportService.ts
import * as XLSX from 'xlsx';
import type { Bay, BaySignal, Equipment, ApparatusType, EquipmentCategory } from '../types';

const APPARATUS_TYPES = ['Aflrofi', 'Skilrofi', 'Jarðrofi', 'Spennir', 'Stjórnbúnaður', 'Annað'];

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const APPARATUS_HEADERS = ['Kóði', 'Gerð', 'Lýsing'];
const IED_HEADERS = ['Tech key', 'IED nafn', 'Framleiðandi', 'Líkan', 'Lýsing'];

export function exportEquipmentTemplate(equipment: Equipment[], projectName: string): void {
  const wb = XLSX.utils.book_new();

  const wsG = XLSX.utils.aoa_to_sheet([
    ['Gerð', 'Lýsing'],
    ['Aflrofi', 'Circuit Breaker (CB)'],
    ['Skilrofi', 'Disconnector (DS)'],
    ['Jarðrofi', 'Earth Switch (ES)'],
    ['Spennir', 'Transformer (TR)'],
    ['Stjórnbúnaður', 'Control equipment'],
    ['Annað', 'Other'],
  ]);
  wsG['!cols'] = [{ wch: 18 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsG, 'Gerðir');

  const apparatus = equipment.filter(e => e.category === 'apparatus' || !e.category);
  const apparatusRows = apparatus.map(e => [e.code, e.type ?? '', e.description]);
  const wsA = XLSX.utils.aoa_to_sheet([APPARATUS_HEADERS, ...apparatusRows]);
  wsA['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 40 }];
  wsA['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, wsA, 'Búnaður');

  const ieds = equipment.filter(e => e.category === 'ied');
  const iedRows = ieds.map(e => [e.code, e.ied_name ?? '', e.manufacturer ?? '', e.model ?? '', e.description]);
  const wsI = XLSX.utils.aoa_to_sheet([IED_HEADERS, ...iedRows]);
  wsI['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 40 }];
  wsI['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, wsI, 'IED');

  XLSX.writeFile(wb, `${projectName}-tæki.xlsx`);
}

export function importEquipmentFromExcel(file: File): Promise<Equipment[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const result: Equipment[] = [];

        const wsA = wb.Sheets['Búnaður'];
        if (wsA) {
          const rows = XLSX.utils.sheet_to_json<string[]>(wsA, { header: 1, defval: '' }) as string[][];
          for (const row of rows.slice(1)) {
            const code = String(row[0] ?? '').trim().toUpperCase();
            if (!code) continue;
            const type = String(row[1] ?? '').trim();
            result.push({
              id: uuid(),
              category: 'apparatus' as EquipmentCategory,
              code,
              type: (APPARATUS_TYPES.includes(type) ? type : 'Annað') as ApparatusType,
              ied_name: null,
              manufacturer: null,
              model: null,
              template_id: null,
              description: String(row[2] ?? '').trim(),
            });
          }
        }

        const wsI = wb.Sheets['IED'];
        if (wsI) {
          const rows = XLSX.utils.sheet_to_json<string[]>(wsI, { header: 1, defval: '' }) as string[][];
          for (const row of rows.slice(1)) {
            const code = String(row[0] ?? '').trim().toUpperCase();
            if (!code) continue;
            result.push({
              id: uuid(),
              category: 'ied' as EquipmentCategory,
              code,
              type: null,
              ied_name: String(row[1] ?? '').trim() || null,
              manufacturer: String(row[2] ?? '').trim() || null,
              model: String(row[3] ?? '').trim() || null,
              template_id: null,
              description: String(row[4] ?? '').trim(),
            });
          }
        }

        resolve(result);
      } catch {
        reject(new Error('Gat ekki lesið Excel skrá'));
      }
    };
    reader.onerror = () => reject(new Error('Villa við lestur skrár'));
    reader.readAsArrayBuffer(file);
  });
}

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
