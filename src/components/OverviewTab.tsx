// src/components/OverviewTab.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { useLibrary } from '../context/LibraryContext';
import { listBayFiles, saveBay, type BayFile } from '../services/bayService';
import { loadStation } from '../services/stationService';
import { useAutoCommit } from '../github/useAutoCommit';
import { exportAllBaysToExcel, exportZenonAllBaysVariables, exportZenonAllBaysRematrix } from '../services/exportService';
import { Button } from './ui';
import { SignalTable } from './SignalTable';
import type { Bay, BaySignal, Equipment, ProjectPhase } from '../types';

interface Props {
  projectId: string;
  projectName: string;
  projectPhase: ProjectPhase;
}

type PhaseFilter = 'ALL' | ProjectPhase;
type SourceFilter = 'ALL' | 'IED' | 'HARDWIRED';

export function OverviewTab({ projectId, projectName, projectPhase }: Props) {
  const { api } = useApi();
  const { signalStates: states, signalLibrary: library, loading: libLoading } = useLibrary();
  const navigate = useNavigate();

  const [bayFiles, setBayFiles] = useState<BayFile[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const bayFilesRef = useRef<BayFile[]>([]);
  bayFilesRef.current = bayFiles;
  const dirtyBayIdsRef = useRef<Set<string>>(new Set());

  const [stationSignals, setStationSignals] = useState<BaySignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      api.readJson<Equipment[]>(`projects/${projectId}/equipment.json`)
        .then(r => r.data)
        .catch(() => [] as Equipment[]),
    ]).then(([files, stationFile, eq]) => {
      setBayFiles(files);
      setStationSignals(stationFile.station.signals);
      setEquipment(eq);
    }).catch(() => setError('Gat ekki hlaðið gögnum. Reyndu aftur.'))
      .finally(() => setLoading(false));
  }, [api, projectId]);

  const isCommittingRef = useRef(false);

  const commitAll = async () => {
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;
    try {
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
    } finally {
      isCommittingRef.current = false;
    }
  };

  useAutoCommit(isDirty, commitAll);

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

  // Only rebuild handlers when bay IDs change (add/remove), not on every signal edit
  const bayIdKey = useMemo(() => bayFiles.map(f => f.bay.id).join(','), [bayFiles]);
  const bayUpdateHandlers = useMemo(
    () => new Map(bayFiles.map(f => [f.bay.id, handleUpdate(f.bay.id)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bayIdKey, handleUpdate]
  );

  const noop = useCallback(() => {}, []);

  const handleExport = () => {
    const syntheticStationBay: Bay = {
      id: 'station', voltage_level: '', bay_name: 'Stöðvarmerki',
      display_id: 'STÖÐ', description: null, equipment_ids: [],
      signals: stationSignals, status: 'DRAFT', review: null,
    };
    exportAllBaysToExcel([...bayFiles.map(f => f.bay), syntheticStationBay], projectName);
  };

  const allBaysWithStation = (): Bay[] => {
    const syntheticStationBay: Bay = {
      id: 'station', voltage_level: '', bay_name: 'Stöðvarmerki',
      display_id: 'STÖÐ', description: null, equipment_ids: [],
      signals: stationSignals, status: 'DRAFT', review: null,
    };
    return [...bayFiles.map(f => f.bay), syntheticStationBay];
  };

  const handleExportZenonVar = () => exportZenonAllBaysVariables(allBaysWithStation(), projectName, states);
  const handleExportZenonRema = () => exportZenonAllBaysRematrix(allBaysWithStation(), projectName, states);

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

  const bayKeys = useMemo(() => [
    ...bayFiles.map(f => ({ key: f.bay.id, label: f.bay.display_id })),
    { key: 'station', label: 'Stöð' },
  ], [bayFiles]);

  const bayFlagCounts = useMemo(
    () => new Map(bayFiles.map(f => [f.bay.id, f.bay.signals.filter(s => s.review_flagged).length])),
    [bayFiles]
  );

  const filteredBaySignals = useMemo(() => {
    const q = search.toLowerCase().trim();
    return bayFiles.map(f => {
      const signals = f.bay.signals.filter(sig => {
        if (selectedBays.size > 0 && !selectedBays.has(f.bay.id)) return false;
        if (q) {
          const hay = [
            sig.signal_name, sig.name_is, sig.name_en ?? '',
            sig.equipment_code,
            sig.iec61850_ied ?? '', sig.iec61850_ld ?? '',
            sig.iec61850_ln ?? '', sig.iec61850_do ?? '', sig.iec61850_da ?? '',
            sig.iec61850_dataset ?? '',
          ].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (phaseFilter !== 'ALL' && sig.phase_added !== phaseFilter) return false;
        if (sourceFilter !== 'ALL' && sig.source_type !== sourceFilter) return false;
        if (alarmOnly && !sig.is_alarm) return false;
        if (untestedOnly && sig.fat_tested && sig.sat_tested) return false;
        return true;
      });
      return { file: f, signals };
    }).filter(({ signals }) => signals.length > 0);
  }, [bayFiles, search, selectedBays, phaseFilter, sourceFilter, alarmOnly, untestedOnly]);

  const filteredStationSignals = useMemo(() => {
    const q = search.toLowerCase().trim();
    return stationSignals.filter(sig => {
      if (selectedBays.size > 0 && !selectedBays.has('station')) return false;
      if (q) {
        const hay = [sig.signal_name, sig.name_is, sig.name_en ?? '', sig.equipment_code].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (phaseFilter !== 'ALL' && sig.phase_added !== phaseFilter) return false;
      if (sourceFilter !== 'ALL' && sig.source_type !== sourceFilter) return false;
      if (alarmOnly && !sig.is_alarm) return false;
      if (untestedOnly && sig.fat_tested && sig.sat_tested) return false;
      return true;
    });
  }, [stationSignals, search, selectedBays, phaseFilter, sourceFilter, alarmOnly, untestedOnly]);

  const totalVisible = filteredBaySignals.reduce((n, { signals }) => n + signals.length, 0) + filteredStationSignals.length;
  const totalAll = useMemo(
    () => bayFiles.reduce((n, f) => n + f.bay.signals.length, 0) + stationSignals.length,
    [bayFiles, stationSignals],
  );

  if (loading || libLoading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;
  if (error) return <p style={{ color: 'var(--danger)' }}>{error}</p>;

  return (
    <div>
      {/* Bay tab strip */}
      {bayFiles.length > 0 && (
        <div style={{
          display: 'flex', overflowX: 'auto', gap: '2px',
          borderBottom: '1px solid var(--line)',
          marginBottom: 'var(--space-4)',
        }}>
          {bayFiles.map(f => {
            const flagCount = bayFlagCounts.get(f.bay.id) ?? 0;
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
          }
        )}
        </div>
      )}

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        {[
          { label: 'Reitir', value: bayFiles.length },
          { label: 'IED búnaður', value: equipment.filter(e => e.category === 'ied').length },
          { label: 'Heildar merki', value: totalAll },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 14px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', minWidth: '80px' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent)', lineHeight: 1.2 }}>{value}</span>
            <span style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px', whiteSpace: 'nowrap' }}>{label}</span>
          </div>
        ))}
      </div>

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

      {/* Filter row 2 + status + export */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={alarmOnly} onChange={e => setAlarmOnly(e.target.checked)} />
          Bara alarm
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={untestedOnly} onChange={e => setUntestedOnly(e.target.checked)} />
          Bara óprófað
        </label>
        {isDirty && <span style={{ fontSize: '12px', color: 'var(--warn)' }}>● Óvistað</span>}
        {lastSaved && !isDirty && (
          <span style={{ fontSize: '12px', color: 'var(--success)' }}>✓ Vistað {lastSaved.toLocaleTimeString('is-IS')}</span>
        )}
        <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: 'auto' }}>
          Sýnd {totalVisible} af {totalAll} merkjum
        </span>
        <Button size="sm" variant="ghost" onClick={() => commitAll()} disabled={!isDirty}>Vista núna</Button>
        <Button size="sm" variant="ghost" onClick={handleExport} disabled={totalAll === 0}>↓ Excel</Button>
        <Button size="sm" variant="ghost" onClick={handleExportZenonVar} disabled={totalAll === 0}>↓ zenon var</Button>
        <Button size="sm" variant="ghost" onClick={handleExportZenonRema} disabled={totalAll === 0}>↓ zenon rema</Button>
      </div>

      {/* Per-bay editable sections */}
      {filteredBaySignals.map(({ file, signals }) => (
        <div key={file.bay.id} style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            marginBottom: 'var(--space-2)', paddingBottom: 'var(--space-1)',
            borderBottom: '2px solid var(--accent)',
          }}>
            <button
              type="button"
              onClick={() => navigate(`/projects/${projectId}/bays/${file.bay.id}`)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 700,
                fontSize: '13px', padding: 0,
              }}
            >
              {file.bay.display_id}
            </button>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{file.bay.bay_name}</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{signals.length} merki</span>
          </div>
          <SignalTable
            signals={signals}
            equipment={equipment}
            library={library}
            states={states}
            bayDisplayId={file.bay.display_id}
            hideToolbar
            showFatSat
            onUpdate={bayUpdateHandlers.get(file.bay.id)!}
          />
        </div>
      ))}

      {/* Station signals — read-only */}
      {filteredStationSignals.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            marginBottom: 'var(--space-2)', paddingBottom: 'var(--space-1)',
            borderBottom: '2px solid var(--line)',
          }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: 'var(--text-secondary)' }}>STÖÐ</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Stöðvarmerki</span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{filteredStationSignals.length} merki</span>
          </div>
          <SignalTable
            signals={filteredStationSignals}
            equipment={equipment}
            states={states}
            bayDisplayId="STÖÐ"
            hideToolbar
            showFatSat
            onUpdate={noop}
          />
        </div>
      )}

      {filteredBaySignals.length === 0 && filteredStationSignals.length === 0 && (
        <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
          {totalAll === 0 ? 'Engin merki í verkefni.' : 'Engin merki passa við síu.'}
        </p>
      )}
    </div>
  );
}
