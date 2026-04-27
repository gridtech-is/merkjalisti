// src/components/OverviewTab.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { useLibrary } from '../context/LibraryContext';
import { listBayFiles, saveBay, type BayFile } from '../services/bayService';
import { loadStation } from '../services/stationService';
import { useAutoCommit } from '../github/useAutoCommit';
import { exportAllBaysToExcel, exportZenonAllBays } from '../services/exportService';
import { Button } from './ui';
import type { Bay, BaySignal, Equipment, ProjectPhase, SignalState } from '../types';

interface Props {
  projectId: string;
  projectName: string;
  projectPhase: ProjectPhase;
}

type Source =
  | { kind: 'bay'; bayId: string; displayId: string; bayName: string }
  | { kind: 'station' };

interface Row {
  source: Source;
  signal: BaySignal;
}

type PhaseFilter = 'ALL' | ProjectPhase;
type SourceFilter = 'ALL' | 'IED' | 'HARDWIRED';

const cell: React.CSSProperties = {
  padding: '5px 6px',
  borderBottom: '1px solid var(--line-muted)',
  borderRight: '1px solid var(--line-muted)',
  fontSize: '12px',
  verticalAlign: 'middle',
};

const head: React.CSSProperties = {
  ...cell,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  background: 'var(--surface-alt)',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 1,
};

const ORDER = ['00', '01', '10', '11'] as const;

function buildRef(sig: BaySignal): string {
  const ied = sig.iec61850_ied ?? '';
  const ld = sig.iec61850_ld ?? '';
  const pfx = sig.iec61850_ln_prefix ?? '';
  const ln = sig.iec61850_ln ?? '';
  const inst = sig.iec61850_ln_inst ?? '';
  const doN = sig.iec61850_do ?? '';
  const daN = sig.iec61850_da ?? '';
  if (!ld && !ln && !doN) return '—';
  const lnPart = `${pfx}${ln}${inst}`;
  const doPart = [doN, daN].filter(Boolean).join('.');
  const ref = [ld, lnPart].filter(Boolean).join('/') + (doPart ? `.${doPart}` : '');
  return ied ? `${ied}${ref}` : ref;
}

export function OverviewTab({ projectId, projectName, projectPhase }: Props) {
  const { api } = useApi();
  const { signalStates: states, loading: libLoading } = useLibrary();
  const navigate = useNavigate();

  const [bayFiles, setBayFiles] = useState<BayFile[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  void equipment; // used in Task 5
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  void lastSaved; // used in Task 5

  const bayFilesRef = useRef<BayFile[]>([]);
  bayFilesRef.current = bayFiles;
  const dirtyBayIdsRef = useRef<Set<string>>(new Set());

  const [stationSignals, setStationSignals] = useState<BaySignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateLang, setStateLang] = useState<'is' | 'en'>('is');

  const [search, setSearch] = useState('');
  const [selectedBays, setSelectedBays] = useState<Set<string>>(new Set());
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('ALL');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');
  const [alarmOnly, setAlarmOnly] = useState(false);
  const [untestedOnly, setUntestedOnly] = useState(false);

  useEffect(() => {
    Promise.all([
      listBayFiles(api, projectId),
      loadStation(api, projectId),
      api.readJson<Equipment[]>(`projects/${projectId}/equipment.json`),
    ]).then(([files, stationFile, { data: eq }]) => {
      setBayFiles(files);
      setStationSignals(stationFile.station.signals);
      setEquipment(eq);
    }).catch(() => setError('Gat ekki hlaðið gögnum. Reyndu aftur.'))
      .finally(() => setLoading(false));
  }, [api, projectId]);

  const commitAll = async () => {
    const toSave = bayFilesRef.current.filter(f => dirtyBayIdsRef.current.has(f.bay.id));
    if (toSave.length === 0) return;
    const updated = await Promise.all(
      toSave.map(f => saveBay(api, projectId, f, projectPhase))
    );
    setBayFiles(prev => {
      const map = new Map(updated.map(f => [f.bay.id, f]));
      return prev.map(f => map.get(f.bay.id) ?? f);
    });
    dirtyBayIdsRef.current.clear();
    setIsDirty(false);
    setLastSaved(new Date());
  };

  useAutoCommit(isDirty, commitAll);

  // handleUpdate is wired up in Task 5 (per-bay SignalTable sections)
  const handleUpdate = useCallback((bayId: string) => (signalId: string, patch: Partial<BaySignal>) => {
    setBayFiles(prev => prev.map(f => {
      if (f.bay.id !== bayId) return f;
      const bay: Bay = {
        ...f.bay,
        signals: f.bay.signals.map(s => s.id === signalId ? { ...s, ...patch } : s),
      };
      return { ...f, bay };
    }));
    dirtyBayIdsRef.current.add(bayId);
    setIsDirty(true);
  }, []);
  void handleUpdate; // used in Task 5

  const stateIndex = useMemo(() => {
    const m = new Map<string, SignalState>();
    for (const s of states) m.set(s.id, s);
    return m;
  }, [states]);

  const rows: Row[] = useMemo(() => {
    const bayRows: Row[] = bayFiles.flatMap(f =>
      f.bay.signals.map(signal => ({
        source: { kind: 'bay' as const, bayId: f.bay.id, displayId: f.bay.display_id, bayName: f.bay.bay_name },
        signal,
      }))
    );
    const stationRows: Row[] = stationSignals.map(signal => ({
      source: { kind: 'station' as const },
      signal,
    }));
    return [...bayRows, ...stationRows];
  }, [bayFiles, stationSignals]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter(r => {
      if (q) {
        const hay = [
          r.signal.signal_name, r.signal.name_is, r.signal.name_en ?? '',
          r.signal.equipment_code,
          r.signal.iec61850_ied ?? '', r.signal.iec61850_ld ?? '',
          r.signal.iec61850_ln ?? '', r.signal.iec61850_do ?? '', r.signal.iec61850_da ?? '',
          r.signal.iec61850_dataset ?? '',
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (selectedBays.size > 0) {
        const key = r.source.kind === 'bay' ? r.source.bayId : 'station';
        if (!selectedBays.has(key)) return false;
      }
      if (phaseFilter !== 'ALL' && r.signal.phase_added !== phaseFilter) return false;
      if (sourceFilter !== 'ALL' && r.signal.source_type !== sourceFilter) return false;
      if (alarmOnly && !r.signal.is_alarm) return false;
      if (untestedOnly && r.signal.fat_tested && r.signal.sat_tested) return false;
      return true;
    });
  }, [rows, search, selectedBays, phaseFilter, sourceFilter, alarmOnly, untestedOnly]);

  const handleExport = () => {
    const syntheticStationBay: Bay = {
      id: 'station', voltage_level: '', bay_name: 'Stöðvarmerki',
      display_id: 'STÖÐ', description: null, equipment_ids: [],
      signals: stationSignals, status: 'DRAFT', review: null,
    };
    exportAllBaysToExcel([...bayFiles.map(f => f.bay), syntheticStationBay], projectName);
  };

  const handleExportZenon = () => {
    const syntheticStationBay: Bay = {
      id: 'station', voltage_level: '', bay_name: 'Stöðvarmerki',
      display_id: 'STÖÐ', description: null, equipment_ids: [],
      signals: stationSignals, status: 'DRAFT', review: null,
    };
    exportZenonAllBays([...bayFiles.map(f => f.bay), syntheticStationBay], projectName, states);
  };

  const toggleBayFilter = (key: string) => {
    setSelectedBays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectStyle: React.CSSProperties = {
    background: 'var(--surface-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '5px 8px', fontSize: '12px', outline: 'none',
  };

  const bayKeys = [
    ...bayFiles.map(f => ({ key: f.bay.id, label: f.bay.display_id })),
    { key: 'station', label: 'Stöð' },
  ];

  if (loading || libLoading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;
  if (error) return <p style={{ color: 'var(--danger)' }}>{error}</p>;

  return (
    <div>
      {/* Bay tab strip — navigate to individual bay */}
      {bayFiles.length > 0 && (
        <div style={{
          display: 'flex', overflowX: 'auto', gap: '2px',
          borderBottom: '1px solid var(--line)',
          marginBottom: 'var(--space-4)',
        }}>
          {bayFiles.map(f => {
            const flagCount = f.bay.signals.filter(s => s.review_flagged).length;
            return (
              <button
                key={f.bay.id}
                type="button"
                onClick={() => navigate(`/projects/${projectId}/bays/${f.bay.id}`)}
                style={{
                  flexShrink: 0, padding: '6px 14px', fontSize: '12px', fontWeight: 400,
                  cursor: 'pointer', background: 'none', border: 'none',
                  borderBottom: '2px solid transparent',
                  color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginBottom: '-1px',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderBottomColor = 'color-mix(in srgb, var(--accent) 40%, transparent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLButtonElement).style.borderBottomColor = 'transparent'; }}
              >
                {f.bay.display_id}
                {flagCount > 0 && (
                  <span style={{ marginLeft: '5px', fontSize: '10px', color: 'var(--danger)', fontWeight: 700 }}>💬{flagCount}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Filter row 1 */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Leit — kóði, nafn, IEC address..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...selectStyle, minWidth: '240px', flex: '1 1 240px' }} />
        <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value as PhaseFilter)} style={selectStyle}>
          <option value="ALL">Allir fasar</option>
          <option value="DESIGN">DESIGN</option>
          <option value="FROZEN">FROZEN</option>
          <option value="REVIEW">REVIEW</option>
          <option value="FAT">FAT</option>
          <option value="SAT">SAT</option>
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as SourceFilter)} style={selectStyle}>
          <option value="ALL">Allir uppruni</option>
          <option value="IED">IED</option>
          <option value="HARDWIRED">HARDWIRED</option>
        </select>
      </div>

      {/* Bay chips */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: 'var(--muted)', alignSelf: 'center' }}>Reit:</span>
        {bayKeys.map(b => {
          const active = selectedBays.size === 0 || selectedBays.has(b.key);
          return (
            <button key={b.key} type="button" onClick={() => toggleBayFilter(b.key)} style={{
              padding: '2px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
              background: active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface-alt)',
              color: active ? 'var(--accent)' : 'var(--muted)', fontFamily: 'monospace',
            }}>{b.label}</button>
          );
        })}
        {selectedBays.size > 0 && (
          <button type="button" onClick={() => setSelectedBays(new Set())} style={{
            padding: '2px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--line)', background: 'none', color: 'var(--muted)', cursor: 'pointer',
          }}>Hreinsa</button>
        )}
      </div>

      {/* Filter row 2 + IS/EN toggle */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* IS/EN toggle */}
        <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
          {(['is', 'en'] as const).map(lang => (
            <button key={lang} type="button" onClick={() => setStateLang(lang)}
              style={{ padding: '2px 10px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: stateLang === lang ? 'var(--accent)' : 'transparent',
                color: stateLang === lang ? '#fff' : 'var(--text-secondary)' }}>
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={alarmOnly} onChange={e => setAlarmOnly(e.target.checked)} />
          Bara alarm
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={untestedOnly} onChange={e => setUntestedOnly(e.target.checked)} />
          Bara óprófað
        </label>
        <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: 'auto' }}>
          Sýnd {filtered.length} af {rows.length} merkjum
        </span>
        <Button size="sm" variant="ghost" onClick={handleExport} disabled={rows.length === 0}>↓ Excel</Button>
        <Button size="sm" variant="ghost" onClick={handleExportZenon} disabled={rows.length === 0}>↓ zenon</Button>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'auto', maxHeight: '70vh' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...head, whiteSpace: 'nowrap' }}>Reit</th>
              {(['#', 'Tæki', 'Merki', 'Kóði', 'Texti'] as string[]).map(h => (
                <th key={h} rowSpan={2} style={head}>{h}</th>
              ))}
              <th colSpan={2} style={{ ...head, borderLeft: '2px solid var(--line)', textAlign: 'center' }}>Stöður</th>
              {(['Alarm', 'Fl.', 'Uppruni'] as string[]).map(h => (
                <th key={h} rowSpan={2} style={head}>{h}</th>
              ))}
              <th colSpan={13} style={{ ...head, borderLeft: '2px solid var(--accent)', color: 'var(--accent)', textAlign: 'center' }}>
                IEC 61850
              </th>
              <th rowSpan={2} style={head}>Fasi</th>
              <th colSpan={3} style={{ ...head, borderLeft: '2px solid var(--success)', color: 'var(--success)', textAlign: 'center' }}>FAT</th>
              <th colSpan={3} style={{ ...head, borderLeft: '2px solid var(--warning)', color: 'var(--warning)', textAlign: 'center' }}>SAT</th>
            </tr>
            <tr>
              {(['Staða', 'Tegund'] as string[]).map((h, i) => (
                <th key={`st-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--line)' : undefined }}>{h}</th>
              ))}
              {(['IED', 'ldInst', 'Prefix', 'lnClass', 'lnInst', 'doName', 'daName', 'FC', 'CDC', 'Dataset', 'RCB', 'DSE', 'Ref.'] as string[]).map((h, i) => (
                <th key={`ie-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--accent)' : undefined }}>{h}</th>
              ))}
              {(['✓', 'Niðurstaða', 'Prófari'] as string[]).map((h, i) => (
                <th key={`fat-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--success)' : undefined }}>{h}</th>
              ))}
              {(['✓', 'Niðurstaða', 'Prófari'] as string[]).map((h, i) => (
                <th key={`sat-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--warning)' : undefined }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={99} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-8)' }}>Engin merki</td></tr>
            )}
            {filtered.map((r, i) => {
              const sig = r.signal;
              const st = sig.state_id ? stateIndex.get(sig.state_id) : undefined;
              const map = sig.state_alarm_map ?? {};
              const fatColor = sig.fat_result === 'PASS' ? 'var(--success)' : sig.fat_result === 'FAIL' ? 'var(--danger)' : 'var(--muted)';
              const satColor = sig.sat_result === 'PASS' ? 'var(--success)' : sig.sat_result === 'FAIL' ? 'var(--danger)' : 'var(--muted)';
              const mono: React.CSSProperties = { fontFamily: 'monospace', fontSize: '11px' };

              // State rows (00/01/10/11)
              const stateRows = st
                ? ORDER.map(k => {
                    const entry = st.states[k];
                    if (!entry) return null;
                    return { k, text: (stateLang === 'is' ? entry.is : entry.en) ?? k };
                  }).filter(Boolean)
                : [];

              // Alarm rows per state
              const alarmRows = st
                ? ORDER.map(k => {
                    if (!st.states[k]) return null;
                    const cfg = map[k] ?? { is_alarm: false, alarm_class: null };
                    return { k, cfg };
                  }).filter(Boolean)
                : [];

              return (
                <tr key={sig.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                  {/* Reit */}
                  <td style={{ ...cell, ...mono, fontWeight: 600 }}>
                    {r.source.kind === 'bay' ? (
                      <button type="button"
                        onClick={() => { if (r.source.kind === 'bay') navigate(`/projects/${projectId}/bays/${r.source.bayId}`); }}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, font: 'inherit' }}>
                        {r.source.displayId}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>Stöð</span>
                    )}
                  </td>
                  <td style={{ ...cell, color: 'var(--muted)', fontSize: '11px', width: '28px' }}>{i + 1}</td>
                  <td style={{ ...cell, ...mono, color: 'var(--accent)', minWidth: '60px' }}>{sig.equipment_code}</td>
                  <td style={{ ...cell, ...mono, color: 'var(--accent)', minWidth: '110px' }}>{sig.signal_name}</td>
                  {/* Kóði */}
                  <td style={{ ...cell, ...mono, minWidth: '90px', color: 'var(--text-secondary)' }}>{sig.signal_name}</td>
                  {/* Texti — IS eða EN */}
                  <td style={{ ...cell, minWidth: '140px' }}>
                    {stateLang === 'is' ? sig.name_is : (sig.name_en || sig.name_is)}
                  </td>

                  {/* Stöður — Staða */}
                  <td style={{ ...cell, borderLeft: '2px solid var(--line)', minWidth: '160px', verticalAlign: 'top', padding: '4px 6px' }}>
                    {stateRows.length > 0 ? stateRows.map(row => {
                      if (!row) return null;
                      return (
                        <div key={row.k} style={{ display: 'flex', gap: '6px', marginBottom: '2px', fontSize: '11px' }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--muted)', minWidth: '22px' }}>{row.k}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{row.text}</span>
                        </div>
                      );
                    }) : <span style={{ color: 'var(--muted)', fontSize: '11px' }}>—</span>}
                  </td>
                  {/* Tegund */}
                  <td style={{ ...cell, ...mono, fontSize: '11px', color: 'var(--muted)' }}>{st?.type ?? '—'}</td>

                  {/* Alarm */}
                  <td style={{ ...cell, verticalAlign: 'top', padding: '4px 6px' }}>
                    {alarmRows.length > 0 ? alarmRows.map(row => {
                      if (!row) return null;
                      return (
                        <div key={row.k} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', height: '18px' }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--muted)', fontSize: '10px', minWidth: '22px' }}>{row.k}</span>
                          <span style={{ color: row.cfg.is_alarm ? 'var(--danger)' : 'var(--muted)', fontSize: '11px' }}>
                            {row.cfg.is_alarm ? '✓' : '—'}
                          </span>
                        </div>
                      );
                    }) : (
                      <span style={{ fontSize: '11px' }}>{sig.is_alarm ? '✓' : '—'}</span>
                    )}
                  </td>
                  {/* Fl. (alarm class) */}
                  <td style={{ ...cell, verticalAlign: 'top', padding: '4px 6px', minWidth: '40px' }}>
                    {alarmRows.length > 0 ? alarmRows.map(row => {
                      if (!row) return null;
                      return (
                        <div key={row.k} style={{ height: '18px', marginBottom: '2px', display: 'flex', alignItems: 'center', fontSize: '10px' }}>
                          {row.cfg.is_alarm && row.cfg.alarm_class
                            ? <span style={{ color: 'var(--text-secondary)' }}>F{row.cfg.alarm_class}</span>
                            : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </div>
                      );
                    }) : (
                      <span style={{ fontSize: '11px' }}>
                        {sig.is_alarm && sig.alarm_class ? `F${sig.alarm_class}` : '—'}
                      </span>
                    )}
                  </td>
                  {/* Uppruni */}
                  <td style={{ ...cell, fontSize: '11px' }}>{sig.source_type}</td>

                  {/* IEC 61850 */}
                  <td style={{ ...cell, borderLeft: '2px solid var(--accent)', ...mono, color: 'var(--accent)', minWidth: '70px' }}>{sig.iec61850_ied ?? '—'}</td>
                  <td style={{ ...cell, ...mono, minWidth: '55px' }}>{sig.iec61850_ld ?? '—'}</td>
                  <td style={{ ...cell, ...mono, minWidth: '45px' }}>{sig.iec61850_ln_prefix ?? '—'}</td>
                  <td style={{ ...cell, ...mono, minWidth: '60px' }}>{sig.iec61850_ln ?? '—'}</td>
                  <td style={{ ...cell, ...mono, minWidth: '45px' }}>{sig.iec61850_ln_inst ?? '—'}</td>
                  <td style={{ ...cell, ...mono, minWidth: '55px' }}>{sig.iec61850_do ?? '—'}</td>
                  <td style={{ ...cell, ...mono, minWidth: '55px' }}>{sig.iec61850_da ?? '—'}</td>
                  <td style={{ ...cell, ...mono, minWidth: '35px' }}>{sig.iec61850_fc ?? '—'}</td>
                  <td style={{ ...cell, ...mono, color: 'var(--muted)', minWidth: '40px' }}>{sig.iec61850_cdc ?? '—'}</td>
                  <td style={{ ...cell, ...mono, minWidth: '55px' }}>{sig.iec61850_dataset ?? '—'}</td>
                  <td style={{ ...cell, ...mono, minWidth: '55px' }}>{sig.iec61850_rcb ?? '—'}</td>
                  <td style={{ ...cell, ...mono, minWidth: '45px' }}>{sig.iec61850_dataset_entry ?? '—'}</td>
                  <td style={{ ...cell, ...mono, fontSize: '10px', color: 'var(--muted)', whiteSpace: 'nowrap', minWidth: '120px' }}>{buildRef(sig)}</td>

                  {/* Fasi */}
                  <td style={{ ...cell, fontSize: '10px', color: 'var(--muted)' }}>{sig.phase_added}</td>

                  {/* FAT */}
                  <td style={{ ...cell, textAlign: 'center', borderLeft: '2px solid var(--success)' }}>
                    {sig.fat_tested ? <span style={{ color: 'var(--success)' }}>✓</span> : '—'}
                  </td>
                  <td style={{ ...cell, ...mono, color: fatColor, minWidth: '60px' }}>{sig.fat_result ?? '—'}</td>
                  <td style={{ ...cell, fontSize: '11px', color: 'var(--muted)', minWidth: '80px' }}>{sig.fat_tested_by ?? '—'}</td>

                  {/* SAT */}
                  <td style={{ ...cell, textAlign: 'center', borderLeft: '2px solid var(--warning)' }}>
                    {sig.sat_tested ? <span style={{ color: 'var(--warning)' }}>✓</span> : '—'}
                  </td>
                  <td style={{ ...cell, ...mono, color: satColor, minWidth: '60px' }}>{sig.sat_result ?? '—'}</td>
                  <td style={{ ...cell, fontSize: '11px', color: 'var(--muted)', minWidth: '80px' }}>{sig.sat_tested_by ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
