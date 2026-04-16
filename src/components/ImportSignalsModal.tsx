// src/components/ImportSignalsModal.tsx
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Modal, Button } from './ui';
import type { BaySignal, ProjectPhase, AlarmClass, SourceType, SignalLibraryEntry } from '../types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Column name aliases — Excel headers may vary
const COL_MAP: Record<string, keyof BaySignal> = {
  'equipment_code': 'equipment_code', 'tæki': 'equipment_code', 'tæki kóði': 'equipment_code',
  'signal_name': 'signal_name', 'merki': 'signal_name', 'merkjakóði': 'signal_name',
  'name_is': 'name_is', 'heiti (is)': 'name_is', 'heiti_is': 'name_is',
  'name_en': 'name_en', 'heiti (en)': 'name_en', 'heiti_en': 'name_en',
  'state_id': 'state_id',
  'is_alarm': 'is_alarm', 'alarm': 'is_alarm',
  'alarm_class': 'alarm_class', 'alarm flokkur': 'alarm_class',
  'source_type': 'source_type', 'uppspretta': 'source_type',
  'iec61850_ied': 'iec61850_ied', 'ied': 'iec61850_ied',
  'iec61850_ld': 'iec61850_ld', 'ld': 'iec61850_ld',
  'iec61850_ln': 'iec61850_ln', 'ln': 'iec61850_ln',
  'iec61850_ln_prefix': 'iec61850_ln_prefix', 'ln prefix': 'iec61850_ln_prefix',
  'iec61850_ln_inst': 'iec61850_ln_inst', 'ln inst': 'iec61850_ln_inst',
  'iec61850_do_da': 'iec61850_do_da', 'do/da': 'iec61850_do_da', 'do_da': 'iec61850_do_da',
  'iec61850_fc': 'iec61850_fc', 'fc': 'iec61850_fc',
  'iec61850_cdc': 'iec61850_cdc', 'cdc': 'iec61850_cdc',
  'iec61850_dataset': 'iec61850_dataset', 'dataset': 'iec61850_dataset',
  'iec61850_rcb': 'iec61850_rcb', 'rcb': 'iec61850_rcb',
  'iec61850_dataset_entry': 'iec61850_dataset_entry', 'dataset entry': 'iec61850_dataset_entry',
};

function parseBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') return ['true', '1', 'já', 'yes', 'j', 'y'].includes(val.toLowerCase());
  return false;
}

function str(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;
  return String(val).trim() || null;
}

interface ParsedRow {
  data: BaySignal;
  warnings: string[];
}

function parseRow(raw: Record<string, unknown>, phase: ProjectPhase, libraryIndex?: Map<string, SignalLibraryEntry>): ParsedRow {
  const warnings: string[] = [];

  // Map raw keys to BaySignal fields using COL_MAP
  const mapped: Partial<Record<keyof BaySignal, unknown>> = {};
  for (const [rawKey, value] of Object.entries(raw)) {
    const field = COL_MAP[rawKey.toLowerCase().trim()];
    if (field) mapped[field] = value;
  }

  if (!mapped.equipment_code) warnings.push('Vantar tæki kóða (equipment_code)');
  if (!mapped.signal_name) warnings.push('Vantar merkjakóða (signal_name)');
  if (!mapped.name_is) warnings.push('Vantar íslenskt heiti (name_is)');

  const alarmRaw = mapped.alarm_class;
  let alarmClass: AlarmClass | null = null;
  if (alarmRaw !== undefined && alarmRaw !== null && alarmRaw !== '') {
    const n = Number(alarmRaw);
    if (n === 1 || n === 2 || n === 3) alarmClass = n as AlarmClass;
  }

  const sourceRaw = str(mapped.source_type);
  const source_type: SourceType =
    sourceRaw?.toUpperCase() === 'HARDWIRED' ? 'HARDWIRED' : 'IED';

  const data: BaySignal = {
    id: uuid(),
    equipment_code: str(mapped.equipment_code) ?? '',
    signal_name: str(mapped.signal_name) ?? '',
    name_is: str(mapped.name_is) ?? '',
    name_en: str(mapped.name_en),
    state_id: str(mapped.state_id),
    iec61850_ied: str(mapped.iec61850_ied),
    iec61850_ln_prefix: str(mapped.iec61850_ln_prefix),
    iec61850_ln_inst: str(mapped.iec61850_ln_inst),
    iec61850_rcb: str(mapped.iec61850_rcb),
    iec61850_dataset_entry: str(mapped.iec61850_dataset_entry),
    iec61850_ld: str(mapped.iec61850_ld),
    iec61850_ln: str(mapped.iec61850_ln),
    iec61850_do_da: str(mapped.iec61850_do_da),
    iec61850_fc: str(mapped.iec61850_fc),
    iec61850_cdc: str(mapped.iec61850_cdc),
    iec61850_dataset: str(mapped.iec61850_dataset),
    library_id: libraryIndex?.get(str(mapped.signal_name) ?? '')?.id ?? null,
    is_alarm: parseBool(mapped.is_alarm),
    alarm_class: alarmClass,
    state_alarm_map: null,
    source_type,
    phase_added: phase,
    fat_tested: false, fat_tested_by: null, fat_tested_at: null, fat_result: null,
    sat_tested: false, sat_tested_by: null, sat_tested_at: null, sat_result: null,
  };

  return { data, warnings };
}

interface Props {
  phase: ProjectPhase;
  library?: SignalLibraryEntry[];
  onAdd: (signals: BaySignal[]) => void;
  onClose: () => void;
  onDownloadTemplate?: () => Promise<void>;
}

export function ImportSignalsModal({ phase, library = [], onAdd, onClose, onDownloadTemplate }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const libraryIndex = new Map(library.filter(e => e.code).map(e => [e.code!, e]));

  const loadSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    const parsed = raw
      .filter(r => Object.values(r).some(v => v !== ''))
      .map(r => parseRow(r, phase, libraryIndex));
    setRows(parsed);
  };

  const handleFile = (file: File) => {
    setError('');
    setRows([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        setFileName(file.name);
        const first = wb.SheetNames[0];
        setActiveSheet(first);
        loadSheet(wb, first);
      } catch {
        setError('Gat ekki lesið skrána. Gakktu úr skugga um að þetta sé gilt .xlsx skjal.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSheetChange = (name: string) => {
    setActiveSheet(name);
    if (workbook) loadSheet(workbook, name);
  };

  const validRows = rows.filter(r => r.warnings.length === 0);
  const warnRows = rows.filter(r => r.warnings.length > 0);

  const handleConfirm = () => {
    onAdd(validRows.map(r => r.data));
  };

  return (
    <Modal title="Innflutningur merkja úr Excel" onClose={onClose} width="760px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* Drop zone */}
        {rows.length === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            style={{
              border: '2px dashed var(--line)',
              borderRadius: 'var(--radius)',
              padding: 'var(--space-8)',
              textAlign: 'center',
              cursor: 'pointer',
              color: 'var(--muted)',
              fontSize: '13px',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
          >
            <div style={{ fontSize: '28px', marginBottom: 'var(--space-2)' }}>📂</div>
            <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text)' }}>
              Dragðu .xlsx skrá hingað
            </div>
            <div>eða smelltu til að velja skrá</div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        )}

        {/* Download template */}
        {rows.length === 0 && onDownloadTemplate && (
          <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
            Ertu að nota þetta í fyrsta skipti?{' '}
            <button
              type="button"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try { await onDownloadTemplate(); } finally { setDownloading(false); }
              }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', padding: 0 }}
            >
              {downloading ? 'Hleður...' : 'Hlaða niður Excel sniðmáti'}
            </button>
            {' '}(með dropdown á merkjakóðum)
          </div>
        )}

        {error && (
          <div style={{ fontSize: '13px', color: 'var(--danger)', padding: 'var(--space-3)', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', borderRadius: 'var(--radius-sm)' }}>
            {error}
          </div>
        )}

        {/* Sheet selector */}
        {sheetNames.length > 1 && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ color: 'var(--muted)' }}>Blað:</span>
            {sheetNames.map(name => (
              <button
                key={name}
                type="button"
                onClick={() => handleSheetChange(name)}
                style={{
                  padding: '3px 10px',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-sm)',
                  background: activeSheet === name ? 'var(--accent)' : 'var(--surface-alt)',
                  color: activeSheet === name ? '#fff' : 'var(--text)',
                  cursor: 'pointer', fontSize: '12px',
                }}
              >{name}</button>
            ))}
          </div>
        )}

        {/* Summary */}
        {rows.length > 0 && (
          <div style={{ fontSize: '12px', display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <span style={{ color: 'var(--muted)' }}>{fileName}</span>
            <span style={{ color: 'var(--success)' }}>✓ {validRows.length} merki til innflutnings</span>
            {warnRows.length > 0 && (
              <span style={{ color: 'var(--warn)' }}>⚠ {warnRows.length} línur með villur (verða sleppt)</span>
            )}
            <button
              type="button"
              onClick={() => { setRows([]); setWorkbook(null); setFileName(''); setSheetNames([]); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', marginLeft: 'auto' }}
            >Velja aðra skrá</button>
          </div>
        )}

        {/* Preview table */}
        {rows.length > 0 && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', maxHeight: '340px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-alt)', position: 'sticky', top: 0 }}>
                  {['Tæki', 'Merki', 'Heiti (IS)', 'Heiti (EN)', 'Alarm', 'Uppspretta', 'Staða'].map(h => (
                    <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const s = row.data;
                  const hasWarn = row.warnings.length > 0;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--line-muted)', background: hasWarn ? 'color-mix(in srgb, var(--warn) 8%, transparent)' : 'transparent' }}>
                      <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: 'var(--accent)' }}>{s.equipment_code || '—'}</td>
                      <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{s.signal_name || '—'}</td>
                      <td style={{ padding: '4px 8px' }}>{s.name_is || '—'}</td>
                      <td style={{ padding: '4px 8px', color: 'var(--muted)' }}>{s.name_en ?? '—'}</td>
                      <td style={{ padding: '4px 8px', color: s.is_alarm ? 'var(--danger)' : 'var(--muted)' }}>
                        {s.is_alarm ? `F${s.alarm_class}` : '—'}
                      </td>
                      <td style={{ padding: '4px 8px', color: 'var(--muted)' }}>{s.source_type}</td>
                      <td style={{ padding: '4px 8px' }}>
                        {hasWarn
                          ? <span style={{ color: 'var(--warn)', fontSize: '10px' }} title={row.warnings.join(', ')}>⚠ sleppt</span>
                          : <span style={{ color: 'var(--success)' }}>✓</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Warning detail */}
        {warnRows.length > 0 && (
          <details style={{ fontSize: '11px', color: 'var(--muted)' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--warn)' }}>Sýna villur ({warnRows.length} línur)</summary>
            <ul style={{ marginTop: 'var(--space-2)', paddingLeft: 'var(--space-4)' }}>
              {warnRows.map((r, i) => (
                <li key={i}>Lína {rows.indexOf(r) + 2}: {r.warnings.join(', ')}</li>
              ))}
            </ul>
          </details>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <Button variant="ghost" onClick={onClose}>Hætta við</Button>
          <Button onClick={handleConfirm} disabled={validRows.length === 0}>
            Flytja inn {validRows.length > 0 ? `(${validRows.length})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
