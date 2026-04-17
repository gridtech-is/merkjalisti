// src/components/OverviewTab.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { listBays, loadBay } from '../services/bayService';
import { loadStation } from '../services/stationService';
import { exportAllBaysToExcel } from '../services/exportService';
import { Button } from './ui';
import type { Bay, BaySignal, ProjectPhase } from '../types';

interface Props {
  projectId: string;
  projectName: string;
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

export function OverviewTab({ projectId, projectName }: Props) {
  const { api } = useApi();
  const navigate = useNavigate();

  const [bays, setBays] = useState<Bay[]>([]);
  const [stationSignals, setStationSignals] = useState<BaySignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedBays, setSelectedBays] = useState<Set<string>>(new Set()); // empty = all
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('ALL');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');
  const [alarmOnly, setAlarmOnly] = useState(false);
  const [untestedOnly, setUntestedOnly] = useState(false);

  useEffect(() => {
    Promise.all([
      listBays(api, projectId).then(async (baysMeta) => {
        const full = await Promise.all(baysMeta.map(b => loadBay(api, projectId, b.id).then(f => f.bay)));
        return full;
      }),
      loadStation(api, projectId),
    ]).then(([fullBays, stationFile]) => {
      setBays(fullBays);
      setStationSignals(stationFile.station.signals);
    }).catch(() => setError('Gat ekki hlaðið gögnum. Reyndu aftur.'))
      .finally(() => setLoading(false));
  }, [api, projectId]);

  const rows: Row[] = useMemo(() => {
    const bayRows: Row[] = bays.flatMap(bay =>
      bay.signals.map(signal => ({
        source: { kind: 'bay' as const, bayId: bay.id, displayId: bay.display_id, bayName: bay.bay_name },
        signal,
      }))
    );
    const stationRows: Row[] = stationSignals.map(signal => ({
      source: { kind: 'station' as const },
      signal,
    }));
    return [...bayRows, ...stationRows];
  }, [bays, stationSignals]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter(r => {
      // Search
      if (q) {
        const hay = [
          r.signal.signal_name, r.signal.name_is, r.signal.name_en ?? '',
          r.signal.iec61850_ld ?? '', r.signal.iec61850_ln ?? '', r.signal.iec61850_do_da ?? '',
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // Bay multiselect
      if (selectedBays.size > 0) {
        const key = r.source.kind === 'bay' ? r.source.bayId : 'station';
        if (!selectedBays.has(key)) return false;
      }
      // Phase
      if (phaseFilter !== 'ALL' && r.signal.phase_added !== phaseFilter) return false;
      // Source type
      if (sourceFilter !== 'ALL' && r.signal.source_type !== sourceFilter) return false;
      // Alarm only
      if (alarmOnly && !r.signal.is_alarm) return false;
      // Untested only
      if (untestedOnly && r.signal.fat_tested && r.signal.sat_tested) return false;
      return true;
    });
  }, [rows, search, selectedBays, phaseFilter, sourceFilter, alarmOnly, untestedOnly]);

  const iecAddress = (sig: BaySignal): string => {
    const parts = [sig.iec61850_ld, sig.iec61850_ln, sig.iec61850_do_da].filter(Boolean);
    return parts.length > 0 ? parts.join('/') : '—';
  };

  const handleExport = () => {
    const syntheticStationBay: Bay = {
      id: 'station',
      station: projectName,
      voltage_level: '',
      bay_name: 'Stöðvarmerki',
      display_id: 'STÖÐ',
      equipment_ids: [],
      signals: stationSignals,
      status: 'DRAFT',
      review: null,
    };
    exportAllBaysToExcel([...bays, syntheticStationBay], projectName);
  };

  const toggleBayFilter = (key: string) => {
    setSelectedBays(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;
  if (error) return <p style={{ color: 'var(--danger)' }}>{error}</p>;

  const cell: React.CSSProperties = {
    padding: '5px 8px', borderBottom: '1px solid var(--line-muted)',
    fontSize: '12px', verticalAlign: 'middle',
  };
  const head: React.CSSProperties = {
    ...cell, fontWeight: 600, color: 'var(--text-secondary)',
    background: 'var(--surface-alt)', whiteSpace: 'nowrap',
    position: 'sticky', top: 0, zIndex: 1,
  };
  const selectStyle: React.CSSProperties = {
    background: 'var(--surface-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '5px 8px', fontSize: '12px', outline: 'none',
  };
  const bayKeys: { key: string; label: string }[] = [
    ...bays.map(b => ({ key: b.id, label: b.display_id })),
    { key: 'station', label: 'Stöð' },
  ];

  return (
    <div>
      {/* Filter row 1 */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Leit — kóði, nafn, IEC address..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...selectStyle, minWidth: '240px', flex: '1 1 240px' }}
        />
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

      {/* Bay multiselect chips */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: 'var(--muted)', alignSelf: 'center' }}>Reit:</span>
        {bayKeys.map(b => {
          const active = selectedBays.size === 0 || selectedBays.has(b.key);
          return (
            <button key={b.key} type="button" onClick={() => toggleBayFilter(b.key)}
              style={{
                padding: '2px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
                background: active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface-alt)',
                color: active ? 'var(--accent)' : 'var(--muted)',
                cursor: 'pointer', fontFamily: 'monospace',
              }}>
              {b.label}
            </button>
          );
        })}
        {selectedBays.size > 0 && (
          <button type="button" onClick={() => setSelectedBays(new Set())}
            style={{ padding: '2px 8px', fontSize: '11px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--line)', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
            Hreinsa
          </button>
        )}
      </div>

      {/* Filter row 2 — toggles + count + export */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
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
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'auto', maxHeight: '70vh' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Reit', 'Tæki', 'Kóði', 'Nafn IS', 'Nafn EN', 'Alarm', 'Klass', 'Uppruni', 'IEC 61850', 'Fasi', 'FAT', 'SAT'].map(h => (
                <th key={h} style={head}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={12} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-8)' }}>Engin merki</td></tr>
            )}
            {filtered.map((r, i) => {
              const sig = r.signal;
              const fatColor = sig.fat_result === 'PASS' ? 'var(--success)' : sig.fat_result === 'FAIL' ? 'var(--danger)' : 'var(--text)';
              const satColor = sig.sat_result === 'PASS' ? 'var(--success)' : sig.sat_result === 'FAIL' ? 'var(--danger)' : 'var(--text)';
              return (
                <tr key={sig.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                  <td style={{ ...cell, fontFamily: 'monospace', fontWeight: 600 }}>
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
                  <td style={{ ...cell, fontFamily: 'monospace' }}>{sig.equipment_code}</td>
                  <td style={{ ...cell, fontFamily: 'monospace' }}>{sig.signal_name}</td>
                  <td style={cell}>{sig.name_is}</td>
                  <td style={{ ...cell, color: 'var(--muted)' }}>{sig.name_en ?? '—'}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>{sig.is_alarm ? '✓' : '—'}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>{sig.alarm_class ?? '—'}</td>
                  <td style={{ ...cell, fontSize: '11px' }}>{sig.source_type}</td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>{iecAddress(sig)}</td>
                  <td style={{ ...cell, fontSize: '11px' }}>{sig.phase_added}</td>
                  <td style={{ ...cell, textAlign: 'center', color: fatColor }}>{sig.fat_tested ? '✓' : '—'}</td>
                  <td style={{ ...cell, textAlign: 'center', color: satColor }}>{sig.sat_tested ? '✓' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
