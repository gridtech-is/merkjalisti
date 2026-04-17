// src/services/signalTemplate.ts
// Two-sheet Excel template:
//   "Merki"     — lookup table: all signal library entries (hidden)
//   "Bay merki" — data entry: user writes signal_name in col B,
//                 VLOOKUP pulls name/IEC fields from "Merki" automatically

import * as XLSX from 'xlsx';
import type { SignalLibraryEntry } from '../types';
import type { ScdIed } from './scdParser';

const LOOKUP_SHEET = 'Merki';
const ENTRY_SHEET = 'Bay merki';
const DATA_ROWS = 500;

// ─── "Merki" lookup sheet ─────────────────────────────────────────────────────
// Col: A=code  B=name_is  C=name_en  D=is_alarm  E=alarm_class  F=source_type
//      G=iec61850_ld  H=iec61850_ln  I=iec61850_do_da  J=iec61850_fc
//      K=iec61850_cdc  L=iec61850_dataset

function buildLookupSheet(library: SignalLibraryEntry[]): XLSX.WorkSheet {
  const headers = [
    'code', 'name_is', 'name_en', 'is_alarm', 'alarm_class', 'source_type',
    'iec61850_ld', 'iec61850_ln', 'iec61850_do_da',
    'iec61850_fc', 'iec61850_cdc', 'iec61850_dataset',
  ];
  const rows = library.map(e => [
    e.code ?? '',
    e.name_is,
    e.name_en ?? '',
    e.is_alarm ? 'TRUE' : 'FALSE',
    e.alarm_class ?? '',
    e.source_type,
    e.iec61850_ld ?? '',
    e.iec61850_ln ?? '',
    e.iec61850_do_da ?? '',
    e.iec61850_fc ?? '',
    e.iec61850_cdc ?? '',
    e.iec61850_dataset ?? '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [16, 38, 38, 10, 12, 12, 14, 14, 18, 8, 12, 18].map(w => ({ wch: w }));
  return ws;
}

// ─── "Bay merki" entry sheet ──────────────────────────────────────────────────
// Col A  equipment_code    — user fills in
// Col B  signal_name       — user fills in (looked up in Merki!A)
// Col C  name_is           — VLOOKUP col 2
// Col D  name_en           — VLOOKUP col 3
// Col E  is_alarm          — VLOOKUP col 4
// Col F  alarm_class       — VLOOKUP col 5
// Col G  source_type       — VLOOKUP col 6
// Col H  iec61850_ld       — VLOOKUP col 7
// Col I  iec61850_ln       — VLOOKUP col 8
// Col J  iec61850_do_da    — VLOOKUP col 9
// Col K  iec61850_fc       — VLOOKUP col 10
// Col L  iec61850_cdc      — VLOOKUP col 11
// Col M  iec61850_dataset  — VLOOKUP col 12
// Col N  iec61850_ied      — user fills in
// Col O  iec61850_ln_prefix — user fills in
// Col P  iec61850_ln_inst  — user fills in
// Col Q  iec61850_rcb      — user fills in
// Col R  iec61850_dataset_entry — user fills in

const ENTRY_HEADERS = [
  'equipment_code', 'signal_name',
  'name_is', 'name_en', 'is_alarm', 'alarm_class', 'source_type',
  'iec61850_ld', 'iec61850_ln', 'iec61850_do_da',
  'iec61850_fc', 'iec61850_cdc', 'iec61850_dataset',
  'iec61850_ied', 'iec61850_ln_prefix', 'iec61850_ln_inst',
  'iec61850_rcb', 'iec61850_dataset_entry',
];

// Lookup-formula columns: [col letter (0-based index), VLOOKUP column number in Merki sheet]
const LOOKUP_COLS: Array<[number, number]> = [
  [2, 2],   // C — name_is
  [3, 3],   // D — name_en
  [4, 4],   // E — is_alarm
  [5, 5],   // F — alarm_class
  [6, 6],   // G — source_type
  [7, 7],   // H — iec61850_ld
  [8, 8],   // I — iec61850_ln
  [9, 9],   // J — iec61850_do_da
  [10, 10], // K — iec61850_fc
  [11, 11], // L — iec61850_cdc
  [12, 12], // M — iec61850_dataset
];

function buildEntrySheet(): XLSX.WorkSheet {
  // Build sheet with just the header row
  const ws = XLSX.utils.aoa_to_sheet([ENTRY_HEADERS]);

  // Set formula cells row by row (rows 2..DATA_ROWS+1, 0-based r=1..DATA_ROWS)
  for (let r = 1; r <= DATA_ROWS; r++) {
    const excelRow = r + 1; // Excel row number (1-indexed, row 1 = header)
    for (const [colIdx, vlookupCol] of LOOKUP_COLS) {
      const cellRef = XLSX.utils.encode_cell({ r, c: colIdx });
      ws[cellRef] = {
        f: `IF(B${excelRow}="","",IFERROR(VLOOKUP(B${excelRow},'${LOOKUP_SHEET}'!$A:$L,${vlookupCol},0),""))`,
      };
    }
  }

  // Set sheet range to cover all rows and columns
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: DATA_ROWS, c: ENTRY_HEADERS.length - 1 },
  });

  // Column widths
  ws['!cols'] = [
    16, 18,                        // A–B (user input)
    38, 38, 10, 12, 12,            // C–G (auto)
    14, 14, 18, 8, 12, 18,         // H–M (auto)
    14, 12, 10, 16, 20,            // N–R (user input)
  ].map(w => ({ wch: w }));

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  return ws;
}

// ─── Public export ────────────────────────────────────────────────────────────

export async function generateSignalTemplate(
  fetchLibrary: () => Promise<SignalLibraryEntry[]>
): Promise<void> {
  const library = await fetchLibrary();
  const withCode = library.filter(e => e.code);

  const wb = XLSX.utils.book_new();

  // "Bay merki" first so it opens by default
  XLSX.utils.book_append_sheet(wb, buildEntrySheet(), ENTRY_SHEET);
  XLSX.utils.book_append_sheet(wb, buildLookupSheet(withCode), LOOKUP_SHEET);

  // Hide the lookup sheet
  wb.Workbook = { Sheets: [{}, { Hidden: 1 }], Views: [] };

  XLSX.writeFile(wb, 'merkja-sniðmát.xlsx');
}

// ─── SCD → Excel template ─────────────────────────────────────────────────────
// Generates a template pre-filled with IEC 61850 references extracted from an SCD file.
// Columns A (equipment_code) and B (signal_name) are left blank for the user to fill in.
// IEC 61850 instance data (ied, ld, ln, prefix, inst, do/da, fc, cdc) are pre-filled.

export function generateTemplateFromScd(ieds: ScdIed[], fileName: string): void {
  const SCD_HEADERS = [
    'equipment_code',        // A — user fills in
    'signal_name',           // B — user fills in (match to signal library)
    'iec61850_ied',          // C — from SCD
    'iec61850_ld',           // D — from SCD
    'iec61850_ln',           // E — from SCD
    'iec61850_ln_prefix',    // F — from SCD
    'iec61850_ln_inst',      // G — from SCD
    'iec61850_do_da',        // H — from SCD DataTypeTemplates (may be empty)
    'iec61850_fc',           // I — from SCD DataTypeTemplates (may be empty)
    'iec61850_cdc',          // J — from SCD DataTypeTemplates (may be empty)
    'name_is',               // K — user fills in (or import from signal library later)
    'name_en',               // L — user fills in
    'is_alarm',              // M — user fills in
    'alarm_class',           // N — user fills in
    'source_type',           // O — default IED
  ];

  const rows: (string | number)[][] = [SCD_HEADERS];

  for (const ied of ieds) {
    for (const ld of ied.lds) {
      for (const ln of ld.lns) {
        if (ln.doDas.length > 0) {
          // One row per DO/DA combination
          for (const doda of ln.doDas) {
            rows.push([
              '',                          // A equipment_code
              '',                          // B signal_name
              ied.name,                    // C iec61850_ied
              ld.inst,                     // D iec61850_ld
              ln.lnClass,                  // E iec61850_ln
              ln.prefix,                   // F iec61850_ln_prefix
              ln.inst,                     // G iec61850_ln_inst
              `${doda.doName}.${doda.daName}`, // H iec61850_do_da
              doda.fc,                     // I iec61850_fc
              doda.cdc,                    // J iec61850_cdc
              '',                          // K name_is
              '',                          // L name_en
              '',                          // M is_alarm
              '',                          // N alarm_class
              'IED',                       // O source_type
            ]);
          }
        } else {
          // No DataTypeTemplates resolved — one row per LN
          rows.push([
            '',
            '',
            ied.name,
            ld.inst,
            ln.lnClass,
            ln.prefix,
            ln.inst,
            '',  // do_da unknown
            '',  // fc unknown
            '',  // cdc unknown
            '',
            '',
            '',
            '',
            'IED',
          ]);
        }
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    16, 18,          // A–B user input
    14, 10, 10, 10, 8, // C–G IEC 61850 instance
    18, 6, 10,       // H–J do/da, fc, cdc
    36, 36, 10, 10, 10, // K–O name/alarm/source
  ].map(w => ({ wch: w }));

  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bay merki');

  // Summary sheet with IED overview
  const summaryHeaders = ['IED nafn', 'Framleiðandi', 'Líkan', 'Lýsing', 'LD fjöldi', 'LN fjöldi'];
  const summaryRows = ieds.map(ied => {
    const lnCount = ied.lds.reduce((s, ld) => s + ld.lns.length, 0);
    return [ied.name, ied.manufacturer, ied.model, ied.desc, ied.lds.length, lnCount];
  });
  const summaryWs = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  summaryWs['!cols'] = [14, 12, 12, 36, 10, 10].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, summaryWs, 'IED listi');

  const baseName = fileName.replace(/\.[^.]+$/, '');
  XLSX.writeFile(wb, `${baseName}-merki-sniðmát.xlsx`);
}
