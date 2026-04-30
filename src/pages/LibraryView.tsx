// src/pages/LibraryView.tsx
import { useEffect, useState } from 'react';
import { useApi } from '../context/ApiContext';
import { useLibrary } from '../context/LibraryContext';
import { listProjects } from '../services/projectService';
import { listBays, loadBay, saveBay, listBayTemplates } from '../services/bayService';
import { listEquipmentTemplates, loadEquipmentTemplate, saveEquipmentTemplate, type EquipmentTemplateFile } from '../services/equipmentTemplateService';
import { listSignalUnits, saveSignalUnits } from '../services/signalUnitService';
import { Button } from '../components/ui';
import { EquipmentTemplateEditor } from '../components/EquipmentTemplateEditor';
import type { SignalLibraryEntry, BaySignal, Bay, Project, AlarmClass, SourceType, EquipmentTemplate, BayTemplate, SignalState, StateAlarmMap, SignalUnit, SignalCategory } from '../types';

type LibTab = 'signals' | 'states' | 'units' | 'templates';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function SignalsTab() {
  const { api } = useApi();
  const { signalLibrary: library, signalLibrarySha: libSha, signalStates, loading: libLoading, updateLibrary } = useLibrary();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [bays, setBays] = useState<Bay[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterAlarm, setFilterAlarm] = useState('');
  const [lang, setLang] = useState<'is' | 'en'>('is');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<SignalLibraryEntry | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [targetBayId, setTargetBayId] = useState('');
  const [equipmentCode, setEquipmentCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditField, setBulkEditField] = useState('source_type');
  const [bulkEditValue, setBulkEditValue] = useState('IED');
  const [bulkEditing, setBulkEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signalUnits, setSignalUnits] = useState<SignalUnit[]>([]);

  const emptyNew = (): Partial<SignalLibraryEntry> => ({
    code: '', name_is: '', name_en: null, is_alarm: false, alarm_class: null,
    state_alarm_map: null, source_type: 'IED', iec61850_ln: null,
    iec61850_do: null, iec61850_da: null, iec61850_fc: null, iec61850_cdc: null,
    iec61850_dataset: null, description_is: null, state_id: null,
    signal_type: null, unit_id: null, severity_code: null,
    hmi_event: false, to_control_room: false, comments: null,
  });
  const [newOpen, setNewOpen] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<SignalLibraryEntry>>(emptyNew());
  const [newSaving, setNewSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editEntry, setEditEntry] = useState<Partial<SignalLibraryEntry> | null>(null);
  const [editOrigCode, setEditOrigCode] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listProjects(api),
      listSignalUnits(api),
    ]).then(([projectList, { units }]) => {
      setSignalUnits(units);
      setProjects(projectList);
    }).finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    if (!selectedProjectId) { setBays([]); return; }
    listBays(api, selectedProjectId).then(setBays).catch(() => setBays([]));
  }, [api, selectedProjectId]);

  const buildEntry = (form: Partial<SignalLibraryEntry>, existingId?: string): SignalLibraryEntry => {
    const stateMap = form.state_id ? (form.state_alarm_map ?? null) : null;
    const hasStateAlarm = stateMap ? Object.values(stateMap).some(cfg => cfg?.is_alarm) : false;
    const effectiveIsAlarm = form.state_id ? hasStateAlarm : (form.is_alarm ?? false);
    const effectiveAlarmClass = form.state_id
      ? (hasStateAlarm ? (Object.values(stateMap ?? {}).find(cfg => cfg?.is_alarm)?.alarm_class ?? 1) : null)
      : (effectiveIsAlarm ? (form.alarm_class ?? 1) : null);
    return {
      id: existingId ?? uuid(),
      code: form.code?.trim().toUpperCase() ?? null,
      name_is: form.name_is?.trim() ?? '',
      name_en: form.name_en || null,
      description_is: form.description_is || null,
      state_id: form.state_id || null,
      state_alarm_map: stateMap,
      signal_type: (form.signal_type as SignalCategory) || null,
      unit_id: form.unit_id || null,
      severity_code: form.severity_code || null,
      hmi_event: form.hmi_event ?? false,
      is_alarm: effectiveIsAlarm,
      alarm_class: effectiveAlarmClass as AlarmClass | null,
      to_control_room: form.to_control_room ?? false,
      source_type: (form.source_type ?? 'IED') as SourceType,
      iec61850_ln: form.iec61850_ln || null,
      iec61850_do: form.iec61850_do || null,
      iec61850_da: form.iec61850_da || null,
      iec61850_fc: form.iec61850_fc || null,
      iec61850_cdc: form.iec61850_cdc || null,
      iec61850_dataset: form.iec61850_dataset || null,
      comments: form.comments || null,
    };
  };

  const handleSaveNew = async () => {
    if (!newEntry.code?.trim() || !newEntry.name_is?.trim()) return;
    setNewSaving(true);
    try {
      const entry = buildEntry(newEntry);
      const newLib = [...library, entry];
      const sha = await api.writeJson('data/signal_library.json', newLib, libSha, `Nýtt merki: ${entry.code}`);
      updateLibrary(newLib, sha);
      setNewOpen(false);
      setNewEntry(emptyNew());
    } finally { setNewSaving(false); }
  };

  const handleSaveEdit = async () => {
    if (!editEntry?.id || !editEntry.code?.trim() || !editEntry.name_is?.trim()) return;
    setEditSaving(true);
    try {
      const updated = buildEntry(editEntry, editEntry.id);
      const newLib = library.map(e => e.id === updated.id ? updated : e);
      const sha = await api.writeJson('data/signal_library.json', newLib, libSha, `Uppfæra merki: ${updated.code}`);
      updateLibrary(newLib, sha);
      setEditEntry(null);
      setEditOrigCode(null);
    } finally { setEditSaving(false); }
  };

  const toSignal = (e: SignalLibraryEntry, eqCode: string): BaySignal => ({
    id: uuid(),
    equipment_code: eqCode,
    signal_name: e.code ?? '',
    library_id: e.id,
    name_is: e.name_is,
    name_en: e.name_en ?? null,
    state_id: e.state_id ?? null,
    iec61850_ied: null, iec61850_ln_prefix: null, iec61850_ln_inst: null,
    iec61850_rcb: null, iec61850_dataset_entry: null,
    iec61850_ld: null,
    iec61850_ln: e.iec61850_ln ?? null,
    iec61850_do: e.iec61850_do ?? null,
    iec61850_da: e.iec61850_da ?? null,
    iec61850_fc: e.iec61850_fc ?? null,
    iec61850_cdc: e.iec61850_cdc ?? null,
    iec61850_dataset: e.iec61850_dataset ?? null,
    unit_id: e.unit_id ?? null,
    is_alarm: e.is_alarm,
    alarm_class: e.alarm_class ?? null,
    state_alarm_map: e.state_alarm_map ?? null,
    source_type: e.source_type,
    phase_added: 'DESIGN',
    fat_tested: false, fat_tested_by: null, fat_tested_at: null, fat_result: null,
    sat_tested: false, sat_tested_by: null, sat_tested_at: null, sat_result: null,
    review_flagged: false,
    review_comment: null,
  });

  const handleAdd = async () => {
    if (!targetBayId || !equipmentCode.trim() || !selectedProjectId) return;
    const eqCode = equipmentCode.trim().toUpperCase();
    const entries = adding ? [adding] : library.filter(e => e.code && selected.has(e.code));
    if (entries.length === 0) return;
    setSaving(true);
    try {
      const { bay, sha } = await loadBay(api, selectedProjectId, targetBayId);
      const newSignals = entries.map(e => toSignal(e, eqCode));
      await saveBay(api, selectedProjectId, { bay: { ...bay, signals: [...bay.signals, ...newSignals] }, sha }, 'DESIGN');
      setAdding(null);
      setBulkOpen(false);
      setSelected(new Set());
      setTargetBayId('');
      setEquipmentCode('');
    } finally { setSaving(false); }
  };

  const handleBulkEdit = async () => {
    const selectedCodes = [...selected];
    if (selectedCodes.length === 0) return;
    setBulkEditing(true);
    try {
      let patch: Partial<SignalLibraryEntry> = {};
      if (bulkEditField === 'source_type') patch = { source_type: bulkEditValue as SourceType };
      else if (bulkEditField === 'signal_type') patch = { signal_type: (bulkEditValue as SignalCategory) || null };
      else if (bulkEditField === 'state_id') patch = { state_id: bulkEditValue || null };
      else if (bulkEditField === 'is_alarm') {
        const on = bulkEditValue === 'true';
        patch = { is_alarm: on, alarm_class: on ? 1 : null };
      }
      const newLib = library.map(e => e.code && selectedCodes.includes(e.code) ? { ...e, ...patch } : e);
      const sha = await api.writeJson('data/signal_library.json', newLib, libSha, `Bulk: breyta ${selectedCodes.length} merkjum`);
      updateLibrary(newLib, sha);
      setBulkEditOpen(false);
      setSelected(new Set());
    } finally { setBulkEditing(false); }
  };

  const q = search.toLowerCase().trim();
  const filtered = library.filter(e => {
    if (q && !(
      (e.code?.toLowerCase().includes(q) ?? false) ||
      e.name_is.toLowerCase().includes(q) ||
      (e.name_en?.toLowerCase().includes(q) ?? false)
    )) return false;
    if (filterType && e.signal_type !== filterType) return false;
    if (filterSource && e.source_type !== filterSource) return false;
    if (filterAlarm === 'yes' && !e.is_alarm) return false;
    if (filterAlarm === 'no' && e.is_alarm) return false;
    return true;
  });
  const hasFilter = q || filterType || filterSource || filterAlarm;

  const toggleSelect = (code: string) => setSelected(prev => {
    const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n;
  });
  const allFilteredCodes = filtered.map(e => e.code).filter(Boolean) as string[];
  const allSelected = allFilteredCodes.length > 0 && allFilteredCodes.every(c => selected.has(c));
  const toggleAll = () => setSelected(allSelected
    ? new Set([...selected].filter(c => !allFilteredCodes.includes(c)))
    : new Set([...selected, ...allFilteredCodes])
  );

  const cell: React.CSSProperties = {
    padding: '5px 8px', borderBottom: '1px solid var(--line-muted)',
    fontSize: '12px', verticalAlign: 'middle',
  };
  const head: React.CSSProperties = {
    ...cell, fontWeight: 600, color: 'var(--text-secondary)',
    background: 'var(--surface-alt)', whiteSpace: 'nowrap',
    position: 'sticky', top: 0, zIndex: 1,
  };
  const modalInput: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--surface-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '6px 8px', fontSize: '13px', outline: 'none',
  };
  const dropdownStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '6px 8px', fontSize: '13px', marginBottom: 'var(--space-3)', outline: 'none',
  };

  if (loading || libLoading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        <input
          type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Leita að kóða eða heiti..."
          style={{ flex: 1, minWidth: '200px', maxWidth: '360px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '6px 10px', fontSize: '13px', outline: 'none' }}
        />
        {([
          ['filterType', filterType, setFilterType, [['', '— Tegund —'], ['AI', 'AI'], ['DI', 'DI'], ['DO', 'DO'], ['AO', 'AO']]] ,
          ['filterSource', filterSource, setFilterSource, [['', '— Uppspretta —'], ['IED', 'IED'], ['HARDWIRED', 'Harðvíraður']]],
          ['filterAlarm', filterAlarm, setFilterAlarm, [['', '— Alarm —'], ['yes', 'Já'], ['no', 'Nei']]],
        ] as [string, string, (v: string) => void, [string, string][]][]).map(([key, val, setter, opts]) => (
          <select key={key} value={val} onChange={e => setter(e.target.value)}
            style={{ background: val ? 'color-mix(in srgb, var(--accent) 12%, var(--surface-alt))' : 'var(--surface-alt)', border: `1px solid ${val ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 'var(--radius-sm)', color: val ? 'var(--accent)' : 'var(--text-secondary)', padding: '5px 8px', fontSize: '12px', outline: 'none', cursor: 'pointer', fontWeight: val ? 600 : 400 }}>
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        {hasFilter && (
          <button type="button" onClick={() => { setSearch(''); setFilterType(''); setFilterSource(''); setFilterAlarm(''); }}
            style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
            ✕ Hreinsa
          </button>
        )}
        <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
          {(['is', 'en'] as const).map(l => (
            <button key={l} type="button" onClick={() => setLang(l)}
              style={{ padding: '2px 10px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: lang === l ? 'var(--accent)' : 'transparent',
                color: lang === l ? '#fff' : 'var(--text-secondary)' }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => { setNewOpen(true); setNewEntry(emptyNew()); }}>+ Nýtt merki</Button>
        <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: 'auto' }}>
          {hasFilter ? `${filtered.length} / ${library.length}` : `${library.length} merki`}
        </span>
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          padding: 'var(--space-2) var(--space-4)',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
          marginBottom: 'var(--space-3)', fontSize: '13px',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{selected.size} merki valin</span>
          <Button size="sm" onClick={() => { setBulkOpen(true); setTargetBayId(''); setEquipmentCode(''); }}>+ Bæta við í reit</Button>
          <Button size="sm" variant="ghost" onClick={() => { setBulkEditOpen(true); setBulkEditField('source_type'); setBulkEditValue('IED'); }}>✏ Breyta völdum</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Hætta við val</Button>
        </div>
      )}

      {/* Table */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={head}><input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer' }} /></th>
                {['Kóði', 'Merki', 'Stöður', 'Tegund', 'Alarm', 'Fl.', 'Upprunatengsl'].map(h => (
                  <th key={h} style={head}>{h}</th>
                ))}
                {(['lnClass', 'doName', 'daName', 'FC', 'CDC'] as string[]).map((h, i) => (
                  <th key={`iec-${h}`} style={{ ...head, borderLeft: i === 0 ? '2px solid var(--line)' : undefined }}>{h}</th>
                ))}
                <th style={head}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={15} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-8)' }}>
                  {hasFilter ? 'Ekkert fannst' : 'Tómt safn'}
                </td></tr>
              )}
              {filtered.map((e, i) => {
                const code = e.code ?? '';
                const isSel = selected.has(code);
                const st = signalStates.find(s => s.id === e.state_id);
                const ORDER = ['00', '01', '10', '11'] as const;
                const stateRows: { k: string; text: string }[] = st
                  ? ORDER.flatMap(k => {
                      const entry = st.states[k];
                      if (!entry) return [];
                      const text = lang === 'is' ? entry.is : entry.en;
                      return text ? [{ k, text }] : [];
                    })
                  : [];
                return (
                  <tr key={e.id}
                    style={{ background: isSel ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)', cursor: 'pointer' }}
                    onClick={() => code && toggleSelect(code)}>
                    <td style={{ ...cell, width: '32px', textAlign: 'center' }} onClick={ev => ev.stopPropagation()}>
                      <input type="checkbox" checked={isSel} onChange={() => code && toggleSelect(code)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{code || '—'}</td>
                    <td style={{ ...cell }}>{lang === 'is' ? e.name_is : (e.name_en ?? <span style={{ color: 'var(--muted)' }}>—</span>)}</td>
                    <td style={{ ...cell, minWidth: '160px', verticalAlign: 'top', padding: '4px 6px' }}>
                      {stateRows.length > 0 ? stateRows.map(row => (
                        <div key={row.k} style={{ display: 'flex', gap: '6px', fontSize: '11px', marginBottom: '1px' }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--muted)', minWidth: '22px' }}>{row.k}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{row.text}</span>
                        </div>
                      )) : <span style={{ color: 'var(--muted)', fontSize: '11px' }}>—</span>}
                    </td>
                    <td style={{ ...cell, fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {e.signal_type
                        ? <span style={{ background: e.signal_type === 'AI' || e.signal_type === 'AO' ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface-alt)', color: 'var(--text-secondary)', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace' }}>{e.signal_type}</span>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                      {e.unit_id && (() => { const u = signalUnits.find(u => u.id === e.unit_id); return u ? <span style={{ marginLeft: '4px', color: 'var(--accent)', fontFamily: 'monospace', fontSize: '11px' }}>{u.abbreviation}</span> : null; })()}
                    </td>
                    <td style={{ ...cell, verticalAlign: 'top', padding: '4px 6px' }}>
                      {stateRows.length > 0 ? stateRows.map(row => {
                        const cfg = e.state_alarm_map?.[row.k as '00'|'01'|'10'|'11'];
                        return (
                          <div key={row.k} style={{ height: '18px', display: 'flex', alignItems: 'center' }}>
                            {cfg?.is_alarm ? <span style={{ color: 'var(--danger)', fontSize: '10px' }}>●</span> : <span style={{ color: 'var(--muted)', fontSize: '11px' }}>—</span>}
                          </div>
                        );
                      }) : <span style={{ color: e.is_alarm ? 'var(--danger)' : 'var(--muted)' }}>{e.is_alarm ? '●' : '—'}</span>}
                    </td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', verticalAlign: 'top', padding: '4px 6px' }}>
                      {stateRows.length > 0 ? stateRows.map(row => {
                        const cfg = e.state_alarm_map?.[row.k as '00'|'01'|'10'|'11'];
                        return (
                          <div key={row.k} style={{ height: '18px', display: 'flex', alignItems: 'center', color: 'var(--muted)' }}>
                            {cfg?.is_alarm && cfg.alarm_class ? `F${cfg.alarm_class}` : '—'}
                          </div>
                        );
                      }) : <span>{e.is_alarm && e.alarm_class ? `F${e.alarm_class}` : '—'}</span>}
                    </td>
                    <td style={{ ...cell, fontSize: '11px', color: 'var(--muted)' }}>{e.source_type}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: e.iec61850_ln ? 'var(--text-secondary)' : 'var(--muted)', borderLeft: '2px solid var(--line)', whiteSpace: 'nowrap' }}>{e.iec61850_ln ?? '—'}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: e.iec61850_do ? 'var(--text-secondary)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{e.iec61850_do ?? '—'}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: e.iec61850_da ? 'var(--text-secondary)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{e.iec61850_da ?? '—'}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: e.iec61850_fc ? 'var(--text-secondary)' : 'var(--muted)' }}>{e.iec61850_fc ?? '—'}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: e.iec61850_cdc ? 'var(--text-secondary)' : 'var(--muted)' }}>{e.iec61850_cdc ?? '—'}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }} onClick={ev => ev.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <Button size="sm" variant="ghost" onClick={() => { setAdding(e); setTargetBayId(''); setEquipmentCode(''); }}>+ Bay</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditEntry({ ...e }); setEditOrigCode(e.code); }}>✏</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setNewEntry({ ...e, code: '' }); setNewOpen(true); }}>⧉</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add to bay dialog */}
      {(adding || bulkOpen) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) { setAdding(null); setBulkOpen(false); } }}>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 'var(--space-6)', minWidth: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: 'var(--space-1)' }}>Bæta við í reit</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: 'var(--space-4)' }}>
              {adding
                ? <><span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{adding.code}</span> — {adding.name_is}</>
                : <><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selected.size} merki</span> valin</>
              }
            </div>

            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Verkefni</label>
            <select value={selectedProjectId} onChange={e => { setSelectedProjectId(e.target.value); setTargetBayId(''); }} style={dropdownStyle}>
              <option value="">— veldu verkefni —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Reitur</label>
            <select value={targetBayId} onChange={e => setTargetBayId(e.target.value)} style={dropdownStyle} disabled={!selectedProjectId}>
              <option value="">— veldu reit —</option>
              {bays.map(b => <option key={b.id} value={b.id}>{b.display_id}</option>)}
            </select>

            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tækjakóði</label>
            <input value={equipmentCode} onChange={e => setEquipmentCode(e.target.value.toUpperCase())}
              placeholder="t.d. QA1"
              style={{ ...modalInput, fontFamily: 'monospace', marginBottom: 'var(--space-4)' }} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <Button variant="ghost" onClick={() => { setAdding(null); setBulkOpen(false); }}>Hætta við</Button>
              <Button onClick={handleAdd} disabled={!selectedProjectId || !targetBayId || !equipmentCode.trim() || saving}>
                {saving ? 'Vista...' : adding ? 'Bæta við' : `Bæta við (${selected.size})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk edit modal */}
      {bulkEditOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setBulkEditOpen(false); }}>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 'var(--space-6)', minWidth: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: 'var(--space-1)' }}>Breyta völdum merkjum</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: 'var(--space-4)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selected.size} merki</span> valin
            </div>

            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Reitur</label>
            <select value={bulkEditField} onChange={e => {
              const f = e.target.value;
              setBulkEditField(f);
              setBulkEditValue(f === 'source_type' ? 'IED' : f === 'is_alarm' ? 'false' : '');
            }} style={dropdownStyle}>
              <option value="source_type">Uppspretta</option>
              <option value="signal_type">Tegund</option>
              <option value="state_id">Stöður</option>
              <option value="is_alarm">Alarm</option>
            </select>

            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Gildi</label>
            {bulkEditField === 'source_type' && (
              <select value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} style={dropdownStyle}>
                <option value="IED">IED</option>
                <option value="HARDWIRED">Harðvíraður</option>
              </select>
            )}
            {bulkEditField === 'signal_type' && (
              <select value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} style={dropdownStyle}>
                <option value="">— hreinsa —</option>
                <option value="AI">AI — Analog Input (mæling)</option>
                <option value="DI">DI — Digital Input (staða)</option>
                <option value="DO">DO — Digital Output (stjórn)</option>
                <option value="AO">AO — Analog Output (settpunkt)</option>
              </select>
            )}
            {bulkEditField === 'state_id' && (
              <select value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} style={dropdownStyle}>
                <option value="">— engar stöður —</option>
                {signalStates.map(s => <option key={s.id} value={s.id}>{s.type ?? s.id}</option>)}
              </select>
            )}
            {bulkEditField === 'is_alarm' && (
              <select value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} style={dropdownStyle}>
                <option value="true">Já — alarm</option>
                <option value="false">Nei — ekki alarm</option>
              </select>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <Button variant="ghost" onClick={() => setBulkEditOpen(false)}>Hætta við</Button>
              <Button onClick={handleBulkEdit} disabled={bulkEditing}>
                {bulkEditing ? 'Vista...' : `Breyta (${selected.size})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New/Edit signal modal */}
      {(newOpen || editEntry) && (() => {
        const isEdit = !!editEntry;
        const form = isEdit ? editEntry! : newEntry;
        const setForm = isEdit
          ? (fn: (p: Partial<SignalLibraryEntry>) => Partial<SignalLibraryEntry>) => setEditEntry(prev => prev ? fn(prev) : prev)
          : (fn: (p: Partial<SignalLibraryEntry>) => Partial<SignalLibraryEntry>) => setNewEntry(fn);
        const onClose = () => isEdit ? (setEditEntry(null), setEditOrigCode(null)) : setNewOpen(false);
        const onSave = isEdit ? handleSaveEdit : handleSaveNew;

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 'var(--space-6)', width: '480px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: 'var(--space-4)' }}>
                {isEdit ? `Breyta merki — ${editOrigCode}` : 'Nýtt merki í safn'}
              </div>

              {([
                ['Kóði *', 'code', 'monospace'],
                ['Heiti (IS) *', 'name_is', 'inherit'],
                ['Heiti (EN)', 'name_en', 'inherit'],
              ] as [string, keyof SignalLibraryEntry, string][]).map(([label, field, ff]) => (
                <div key={field} style={{ marginBottom: 'var(--space-3)' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</label>
                  <input
                    value={(form[field] as string | null) ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value || null }))}
                    style={{ ...modalInput, fontFamily: ff }}
                  />
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tegund merkis</label>
                  <select
                    value={form.signal_type ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, signal_type: (e.target.value as SignalCategory) || null, unit_id: (e.target.value === 'AI' || e.target.value === 'AO') ? prev.unit_id : null }))}
                    style={{ ...modalInput, cursor: 'pointer' }}
                  >
                    <option value="">— óþekkt —</option>
                    <option value="AI">AI — Analog Input</option>
                    <option value="DI">DI — Digital Input</option>
                    <option value="DO">DO — Digital Output</option>
                    <option value="AO">AO — Analog Output</option>
                  </select>
                </div>
                {(form.signal_type === 'AI' || form.signal_type === 'AO') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Eining</label>
                    <select
                      value={form.unit_id ?? ''}
                      onChange={e => setForm(prev => ({ ...prev, unit_id: e.target.value || null }))}
                      style={{ ...modalInput, cursor: 'pointer' }}
                    >
                      <option value="">— engin eining —</option>
                      {signalUnits.map(u => (
                        <option key={u.id} value={u.id}>{u.abbreviation} — {u.name_is}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 'var(--space-3)' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Stöður</label>
                <select
                  value={form.state_id ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, state_id: e.target.value || null, state_alarm_map: null }))}
                  style={{ ...modalInput, cursor: 'pointer' }}
                >
                  <option value="">— engar stöður —</option>
                  {signalStates.map(s => {
                    const preview = Object.values(s.states)
                      .map(st => lang === 'is' ? st?.is : st?.en)
                      .filter(Boolean).slice(0, 2).join(' / ');
                    return (
                      <option key={s.id} value={s.id}>
                        {s.id}{s.type ? ` — ${s.type}` : ''}{preview ? ` — ${preview}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {([
                ['lnClass', 'iec61850_ln', 'monospace'],
                ['doName', 'iec61850_do', 'monospace'],
                ['daName', 'iec61850_da', 'monospace'],
                ['FC', 'iec61850_fc', 'monospace'],
                ['CDC', 'iec61850_cdc', 'monospace'],
                ['Dataset', 'iec61850_dataset', 'monospace'],
              ] as [string, keyof SignalLibraryEntry, string][]).map(([label, field, ff]) => (
                <div key={field} style={{ marginBottom: 'var(--space-3)' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</label>
                  <input
                    value={(form[field] as string | null) ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value || null }))}
                    style={{ ...modalInput, fontFamily: ff }}
                  />
                </div>
              ))}

              {form.state_id ? (() => {
                const st = signalStates.find(s => s.id === form.state_id);
                const ORDER = ['00', '01', '10', '11'] as const;
                const alarmSel: React.CSSProperties = { background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '2px 6px', fontSize: '11px', outline: 'none', cursor: 'pointer' };
                return st ? (
                  <div style={{ marginBottom: 'var(--space-3)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Alarm per stöðu</div>
                    {ORDER.map(k => {
                      const entry = st.states[k];
                      if (!entry) return null;
                      const text = lang === 'is' ? entry.is : entry.en;
                      const cfg = form.state_alarm_map?.[k] ?? { is_alarm: false, is_event: false, alarm_class: null };
                      return (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '12px' }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--muted)', minWidth: '24px' }}>{k}</span>
                          <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{text ?? k}</span>
                          <input type="checkbox" checked={cfg.is_alarm} onChange={ev => {
                            const on = ev.target.checked;
                            const newMap: StateAlarmMap = { ...(form.state_alarm_map ?? {}), [k]: { ...cfg, is_alarm: on, alarm_class: on ? (cfg.alarm_class ?? 1) : null } };
                            setForm(prev => ({ ...prev, state_alarm_map: newMap }));
                          }} style={{ cursor: 'pointer' }} />
                          {cfg.is_alarm && (
                            <select value={cfg.alarm_class?.toString() ?? '1'} onChange={ev => {
                              const newMap: StateAlarmMap = { ...(form.state_alarm_map ?? {}), [k]: { ...cfg, alarm_class: Number(ev.target.value) as AlarmClass } };
                              setForm(prev => ({ ...prev, state_alarm_map: newMap }));
                            }} style={alarmSel}>
                              <option value="1">F1</option><option value="2">F2</option><option value="3">F3</option>
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null;
              })() : (
                <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_alarm ?? false}
                      onChange={e => setForm(prev => ({ ...prev, is_alarm: e.target.checked, alarm_class: e.target.checked ? 1 : null }))}
                      style={{ cursor: 'pointer' }} />
                    Alarm
                  </label>
                  {form.is_alarm && (
                    <select value={form.alarm_class?.toString() ?? '1'}
                      onChange={e => setForm(prev => ({ ...prev, alarm_class: Number(e.target.value) as AlarmClass }))}
                      style={{ background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '4px 8px', fontSize: '12px', outline: 'none' }}>
                      <option value="1">F1</option><option value="2">F2</option><option value="3">F3</option>
                    </select>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                <select value={form.source_type ?? 'IED'}
                  onChange={e => setForm(prev => ({ ...prev, source_type: e.target.value as SourceType }))}
                  style={{ background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '4px 8px', fontSize: '12px', outline: 'none' }}>
                  <option value="IED">IED</option>
                  <option value="HARDWIRED">Harðvíraður</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <Button variant="ghost" onClick={onClose}>Hætta við</Button>
                <Button onClick={onSave} disabled={!form.code?.trim() || !form.name_is?.trim() || (isEdit ? editSaving : newSaving)}>
                  {(isEdit ? editSaving : newSaving) ? 'Vista...' : isEdit ? 'Vista breytingar' : 'Vista í safn'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function StatesTab() {
  const { api } = useApi();
  const { signalStates: states, signalStatesSha: stateSha, loading, updateStates } = useLibrary();
  const [lang, setLang] = useState<'is' | 'en'>('is');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [idError, setIdError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const ORDER = ['00', '01', '10', '11'] as const;

  type EntryForm = { k: '00'|'01'|'10'|'11'; enabled: boolean; key: string; is: string; en: string };
  type StateForm = { id: string; type: string; entries: EntryForm[] };

  const emptyForm = (): StateForm => ({
    id: '', type: '',
    entries: ORDER.map(k => ({ k, enabled: false, key: '', is: '', en: '' })),
  });
  const [form, setForm] = useState<StateForm>(emptyForm());


  const openNew = () => { setForm(emptyForm()); setEditingId(null); setIdError(''); setModalOpen(true); };
  const openEdit = (s: SignalState) => {
    setForm({
      id: s.id, type: s.type ?? '',
      entries: ORDER.map(k => {
        const e = s.states[k];
        return { k, enabled: !!e, key: e?.key ?? '', is: e?.is ?? '', en: e?.en ?? '' };
      }),
    });
    setEditingId(s.id); setIdError(''); setModalOpen(true);
  };

  const setEntry = (k: string, patch: Partial<EntryForm>) =>
    setForm(prev => ({ ...prev, entries: prev.entries.map(e => e.k === k ? { ...e, ...patch } : e) }));

  // Build lookup: key → { is, en } from all existing states
  const keyLookup = new Map<string, { is: string; en: string }>();
  for (const s of states) {
    for (const entry of Object.values(s.states)) {
      if (entry?.key) keyLookup.set(entry.key, { is: entry.is ?? '', en: entry.en ?? '' });
    }
  }
  const existingKeys = [...keyLookup.keys()].sort();

  const handleSave = async () => {
    const trimId = form.id.trim();
    if (!trimId) { setIdError('ID er nauðsynlegt'); return; }
    if (states.some(s => s.id === trimId && s.id !== editingId)) { setIdError(`ID "${trimId}" er þegar til`); return; }
    setSaving(true);
    try {
      const built: SignalState = {
        id: trimId,
        type: form.type.trim() || null,
        states: Object.fromEntries(
          form.entries.filter(e => e.enabled).map(e => [e.k, { key: e.key.trim() || null, is: e.is.trim() || null, en: e.en.trim() || null }])
        ) as SignalState['states'],
      };
      const newStates = editingId === null ? [...states, built] : states.map(s => s.id === editingId ? built : s);
      const newSha = await api.writeJson('data/signal_states.json', newStates, stateSha, editingId ? `Uppfæra stöðu: ${trimId}` : `Nýr stöðuflokkur: ${trimId}`);
      updateStates(newStates, newSha); setModalOpen(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    const newStates = states.filter(s => s.id !== id);
    const newSha = await api.writeJson('data/signal_states.json', newStates, stateSha, `Eyða stöðu: ${id}`);
    updateStates(newStates, newSha); setDeletingId(null);
  };

  const cell: React.CSSProperties = { padding: '5px 8px', borderBottom: '1px solid var(--line-muted)', fontSize: '12px', verticalAlign: 'top' };
  const head: React.CSSProperties = { ...cell, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--surface-alt)', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 };
  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '5px 8px', fontSize: '12px', outline: 'none' };

  const q = search.toLowerCase().trim();
  const filtered = q
    ? states.filter(s =>
        s.id.toLowerCase().includes(q) ||
        (s.type?.toLowerCase().includes(q) ?? false) ||
        Object.values(s.states).some(e =>
          (e?.key?.toLowerCase().includes(q) ?? false) ||
          (e?.is?.toLowerCase().includes(q) ?? false) ||
          (e?.en?.toLowerCase().includes(q) ?? false)
        )
      )
    : states;

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Button size="sm" onClick={openNew}>+ Nýr stöðuflokkur</Button>
          <input
            type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Leita að ID, tegund eða stöðutexta..."
            style={{ width: '280px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '5px 10px', fontSize: '13px', outline: 'none' }}
          />
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {search ? `${filtered.length} / ${states.length}` : `${states.length} flokkar`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
          {(['is', 'en'] as const).map(l => (
            <button key={l} type="button" onClick={() => setLang(l)}
              style={{ padding: '2px 10px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: lang === l ? 'var(--accent)' : 'transparent', color: lang === l ? '#fff' : 'var(--text-secondary)' }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['ID', 'Tegund', '00', '01', '10', '11', ''].map(h => <th key={h} style={head}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-8)' }}>{search ? 'Ekkert fannst' : 'Engir stöðuflokkar'}</td></tr>
              )}
              {filtered.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)' }}>{s.id}</td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)' }}>{s.type ?? '—'}</td>
                  {ORDER.map(k => {
                    const entry = s.states[k];
                    const text = entry ? (lang === 'is' ? entry.is : entry.en) : null;
                    return (
                      <td key={k} style={{ ...cell, minWidth: '110px' }}>
                        {entry ? (
                          <div>
                            {entry.key && <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted)', display: 'block' }}>{entry.key}</span>}
                            <span style={{ color: text ? 'var(--text)' : 'var(--muted)' }}>{text ?? '—'}</span>
                          </div>
                        ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                    );
                  })}
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    {deletingId === s.id ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: 'var(--danger)' }}>Eyða?</span>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)}>Já</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>Nei</Button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>✏</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeletingId(s.id)}>🗑</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 'var(--space-6)', width: '520px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: 'var(--space-4)' }}>
              {editingId === null ? 'Nýr stöðuflokkur' : `Breyta — ${editingId}`}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>ID *</label>
                <input value={form.id} onChange={e => { setForm(prev => ({ ...prev, id: e.target.value })); setIdError(''); }}
                  style={{ ...inp, fontFamily: 'monospace', borderColor: idError ? 'var(--danger)' : undefined }} placeholder="t.d. SP, DP, Activated" />
                {idError && <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '3px' }}>{idError}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tegund</label>
                <input value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
                  style={{ ...inp, fontFamily: 'monospace' }} placeholder="t.d. SP" />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Stöður</div>
              {form.entries.map(entry => (
                <div key={entry.k} style={{ marginBottom: 'var(--space-3)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginBottom: entry.enabled ? '6px' : 0 }}>
                    <input type="checkbox" checked={entry.enabled} onChange={e => setEntry(entry.k, { enabled: e.target.checked })} style={{ cursor: 'pointer' }} />
                    <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{entry.k}</span>
                  </label>
                  {entry.enabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', paddingLeft: '20px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>Key</label>
                        <input
                          list={`keys-${entry.k}`}
                          value={entry.key}
                          onChange={e => {
                            const val = e.target.value;
                            const known = keyLookup.get(val);
                            setEntry(entry.k, known ? { key: val, is: known.is, en: known.en } : { key: val });
                          }}
                          style={{ ...inp, fontFamily: 'monospace', fontSize: '11px' }}
                          placeholder="t.d. ON"
                        />
                        <datalist id={`keys-${entry.k}`}>
                          {existingKeys.map(k => <option key={k} value={k} />)}
                        </datalist>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>IS</label>
                        <input value={entry.is} onChange={e => setEntry(entry.k, { is: e.target.value })} style={{ ...inp, fontSize: '11px' }} placeholder="Íslenska" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginBottom: '2px' }}>EN</label>
                        <input value={entry.en} onChange={e => setEntry(entry.k, { en: e.target.value })} style={{ ...inp, fontSize: '11px' }} placeholder="English" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Hætta við</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Vista...' : editingId === null ? 'Vista' : 'Vista breytingar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UnitsTab() {
  const { api } = useApi();
  const [units, setUnits] = useState<SignalUnit[]>([]);
  const [unitsSha, setUnitsSha] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  type UnitForm = { abbreviation: string; name_is: string; name_en: string };
  const emptyForm = (): UnitForm => ({ abbreviation: '', name_is: '', name_en: '' });
  const [form, setForm] = useState<UnitForm>(emptyForm());

  useEffect(() => {
    listSignalUnits(api)
      .then(({ units: u, sha }) => { setUnits(u); setUnitsSha(sha); })
      .finally(() => setLoading(false));
  }, [api]);

  const openNew = () => { setForm(emptyForm()); setEditingId(null); setModalOpen(true); };
  const openEdit = (u: SignalUnit) => {
    setForm({ abbreviation: u.abbreviation, name_is: u.name_is, name_en: u.name_en ?? '' });
    setEditingId(u.id); setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.abbreviation.trim() || !form.name_is.trim()) return;
    setSaving(true);
    try {
      const built: SignalUnit = {
        id: editingId ?? uuid(),
        abbreviation: form.abbreviation.trim(),
        name_is: form.name_is.trim(),
        name_en: form.name_en.trim() || null,
      };
      const newUnits = editingId === null ? [...units, built] : units.map(u => u.id === editingId ? built : u);
      const newSha = await saveSignalUnits(api, newUnits, unitsSha, editingId ? `Uppfæra einingu: ${built.abbreviation}` : `Ný eining: ${built.abbreviation}`);
      setUnits(newUnits); setUnitsSha(newSha); setModalOpen(false);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    const newUnits = units.filter(u => u.id !== id);
    const newSha = await saveSignalUnits(api, newUnits, unitsSha, `Eyða einingu: ${units.find(u => u.id === id)?.abbreviation ?? id}`);
    setUnits(newUnits); setUnitsSha(newSha); setDeletingId(null);
  };

  const cell: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--line-muted)', fontSize: '13px', verticalAlign: 'middle' };
  const head: React.CSSProperties = { ...cell, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--surface-alt)', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 };
  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '6px 8px', fontSize: '13px', outline: 'none' };

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <Button size="sm" onClick={openNew}>+ Ný eining</Button>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{units.length} einingar</span>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', maxWidth: '600px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Skammstöfun', 'Heiti (IS)', 'Heiti (EN)', ''].map(h => <th key={h} style={head}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {units.length === 0 && (
              <tr><td colSpan={4} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-8)' }}>Engar einingar skráðar</td></tr>
            )}
            {units.map((u, i) => (
              <tr key={u.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                <td style={{ ...cell, fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)' }}>{u.abbreviation}</td>
                <td style={cell}>{u.name_is}</td>
                <td style={{ ...cell, color: u.name_en ? 'var(--text)' : 'var(--muted)' }}>{u.name_en ?? '—'}</td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                  {deletingId === u.id ? (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--danger)' }}>Eyða?</span>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(u.id)}>Já</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>Nei</Button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>✏</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeletingId(u.id)}>🗑</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 'var(--space-6)', width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: 'var(--space-4)' }}>
              {editingId === null ? 'Ný eining' : `Breyta — ${units.find(u => u.id === editingId)?.abbreviation}`}
            </div>

            {([['Skammstöfun *', 'abbreviation', 'monospace'], ['Heiti (IS) *', 'name_is', 'inherit'], ['Heiti (EN)', 'name_en', 'inherit']] as [string, keyof UnitForm, string][]).map(([label, field, ff]) => (
              <div key={field} style={{ marginBottom: 'var(--space-3)' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</label>
                <input
                  value={form[field]}
                  onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                  style={{ ...inp, fontFamily: ff }}
                  placeholder={field === 'abbreviation' ? 't.d. kV, MW, A' : ''}
                />
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Hætta við</Button>
              <Button onClick={handleSave} disabled={!form.abbreviation.trim() || !form.name_is.trim() || saving}>
                {saving ? 'Vista...' : editingId === null ? 'Vista' : 'Vista breytingar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplatesTab() {
  const { api } = useApi();
  const { signalLibrary } = useLibrary();
  const [eqCatalog, setEqCatalog] = useState<EquipmentTemplate[]>([]);
  const [eqSignalTemplates, setEqSignalTemplates] = useState<EquipmentTemplate[]>([]);
  const [bayTemplates, setBayTemplates] = useState<BayTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'equipment' | 'bay'>('equipment');
  const [editingFile, setEditingFile] = useState<EquipmentTemplateFile | null>(null);

  useEffect(() => {
    Promise.all([
      api.readJson<EquipmentTemplate[]>('data/equipment_templates.json').catch(() => ({ data: [] as EquipmentTemplate[], sha: '' })),
      listEquipmentTemplates(api),
      listBayTemplates(api),
    ]).then(([{ data: catalog }, signalTmpl, bay]) => {
      setEqCatalog(catalog.map(t => ({ ...t, signals: t.signals ?? [] })));
      setEqSignalTemplates(signalTmpl);
      setBayTemplates(bay);
    }).catch(() => {
      setLoadError('Villa við að hlaða sniðmátum. Reyndu aftur.');
    }).finally(() => setLoading(false));
  }, [api]);

  const handleNewTemplate = async () => {
    const id = crypto.randomUUID();
    const template: EquipmentTemplate = { id, name: 'Nýtt sniðmát', category: 'ied', iec61850_edition: '2', signals: [] };
    const file = { template, sha: '' };
    try {
      const saved = await saveEquipmentTemplate(api, file, true);
      setEqSignalTemplates(prev => [...prev, saved.template]);
      setEditingFile(saved);
    } catch {
      alert('Villa við að búa til sniðmát. Reyndu aftur.');
    }
  };

  const cell: React.CSSProperties = { padding: '5px 8px', borderBottom: '1px solid var(--line-muted)', fontSize: '12px' };
  const head: React.CSSProperties = { ...cell, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--surface-alt)', whiteSpace: 'nowrap' };

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;
  if (loadError) return <p style={{ color: 'var(--danger)' }}>{loadError}</p>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {([['equipment', `Tækjasniðmát (${eqCatalog.length + eqSignalTemplates.length})`], ['bay', `Reitsniðmát (${bayTemplates.length})`]] as ['equipment' | 'bay', string][]).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setSubTab(id)}
            style={{
              background: subTab === id ? 'var(--accent)' : 'var(--surface-alt)',
              color: subTab === id ? 'white' : 'var(--text-secondary)',
              border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
              padding: '5px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            }}>{label}</button>
        ))}
      </div>

      {subTab === 'equipment' && (
        <>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <button type="button" onClick={handleNewTemplate}
              style={{ padding: '5px 14px', fontSize: '12px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
              + Nýtt signal-sniðmát
            </button>
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Nafn', 'Gerð', 'Framleiðandi', 'Líkan', 'Lýsing'].map(h => <th key={h} style={head}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {eqCatalog.length === 0 && eqSignalTemplates.length === 0 && (
                  <tr><td colSpan={5} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-8)' }}>Engin tækjasniðmát</td></tr>
                )}
                {eqCatalog.map((t, i) => (
                  <tr key={t.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                    <td style={{ ...cell, fontWeight: 600 }}>{t.name}</td>
                    <td style={{ ...cell }}>
                      <span style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: '999px', color: 'var(--text-secondary)' }}>Product catalog</span>
                    </td>
                    <td style={cell}>{t.manufacturer ?? '—'}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px' }}>{t.model ?? '—'}</td>
                    <td style={{ ...cell, color: 'var(--muted)' }}>{t.description ?? '—'}</td>
                  </tr>
                ))}
                {eqSignalTemplates.map((t, i) => (
                  <tr key={t.id}
                    style={{ background: i % 2 === 0 ? 'var(--bg-subtle)' : 'transparent', cursor: 'pointer' }}
                    onClick={async () => {
                      try {
                        const loaded = await loadEquipmentTemplate(api, t.id);
                        setEditingFile(loaded);
                      } catch {
                        alert('Villa við að hlaða sniðmáti. Reyndu aftur.');
                      }
                    }}
                  >
                    <td style={{ ...cell, fontWeight: 600 }}>{t.name}</td>
                    <td style={cell}>
                      <span style={{ fontSize: '10px', padding: '2px 6px', background: 'color-mix(in srgb, var(--accent) 15%, transparent)', border: '1px solid var(--accent)', borderRadius: '999px', color: 'var(--accent)' }}>
                        Sniðmát{t.iec61850_edition ? ` Ed${t.iec61850_edition}` : ''} · {t.signals.length} merki
                      </span>
                    </td>
                    <td style={cell}>{t.manufacturer ?? '—'}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px' }}>{t.model ?? '—'}</td>
                    <td style={{ ...cell, color: 'var(--muted)' }}>{t.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {subTab === 'bay' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Nafn', 'Display ID', 'Merki', 'Tæki'].map(h => <th key={h} style={head}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {bayTemplates.length === 0 && (
                <tr><td colSpan={4} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-8)' }}>Engin reitsniðmát</td></tr>
              )}
              {bayTemplates.map((t, i) => (
                <tr key={t.template_name} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                  <td style={{ ...cell, fontWeight: 600 }}>{t.template_name}</td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px' }}>{t.display_id}</td>
                  <td style={cell}>{t.signals.length}</td>
                  <td style={cell}>{t.equipment_codes.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingFile && (
        <EquipmentTemplateEditor
          file={editingFile}
          library={signalLibrary}
          onSaved={updated => {
            setEqSignalTemplates(prev => prev.map(t => t.id === updated.template.id ? updated.template : t));
            setEditingFile(updated);
          }}
          onDeleted={id => setEqSignalTemplates(prev => prev.filter(t => t.id !== id))}
          onClose={() => setEditingFile(null)}
        />
      )}
    </div>
  );
}

export function LibraryView() {
  const [tab, setTab] = useState<LibTab>('signals');

  const tabStyle = (t: LibTab): React.CSSProperties => ({
    background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer',
    fontSize: '13px', fontWeight: tab === t ? 600 : 400,
    color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    marginBottom: '-1px',
  });

  return (
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
        Library
      </h1>
      <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--line)', marginBottom: 'var(--space-6)' }}>
        <button type="button" style={tabStyle('signals')} onClick={() => setTab('signals')}>Merkjasafn</button>
        <button type="button" style={tabStyle('states')} onClick={() => setTab('states')}>Stöður</button>
        <button type="button" style={tabStyle('units')} onClick={() => setTab('units')}>Einingar</button>
        <button type="button" style={tabStyle('templates')} onClick={() => setTab('templates')}>Sniðmát</button>
      </div>

      {tab === 'signals' && <SignalsTab />}
      {tab === 'states' && <StatesTab />}
      {tab === 'units' && <UnitsTab />}
      {tab === 'templates' && <TemplatesTab />}
    </div>
  );
}
