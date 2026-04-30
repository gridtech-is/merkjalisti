// src/components/SignalTable.tsx
import React, { memo, useMemo, useState, useDeferredValue } from 'react';
import { Button } from './ui';
import { SignalCommentsModal } from './SignalCommentsModal';
import type { BaySignal, Equipment, SignalLibraryEntry, SignalState, StateAlarmMap, AlarmClass, SourceType, IedFcda } from '../types';

const STAT_CLASSES = new Set(['LPHD', 'LGOS', 'LSVS', 'LCCH', 'LTMS', 'LTRK', 'LLN0']);
const PROT_R_CLASSES = new Set(['RBRF', 'RREC', 'RDIR', 'RDRE', 'RFLO', 'RPSB', 'RSYN', 'RTOV']);

const MEAS_CDC = new Set(['MV', 'CMV', 'WYE', 'DEL', 'SEQ', 'HMV', 'HWYE', 'HDEL']);

function suggestDataset(lnClass: string | null, fc: string | null, cdc?: string | null): string | null {
  if (fc === 'MX') return 'Meas';
  if (cdc && MEAS_CDC.has(cdc)) return 'Meas';
  if (lnClass && STAT_CLASSES.has(lnClass)) return 'Stat';
  if (lnClass && (lnClass.startsWith('P') || PROT_R_CLASSES.has(lnClass))) return 'Prot';
  if (fc && ['ST', 'SP', 'SV', 'CO', 'EX'].includes(fc)) return 'Ev';
  if (lnClass || fc || cdc) return 'Ev';
  return null;
}

function fillDatasets(allSignals: BaySignal[], maxSize: number): { id: string; patch: Partial<BaySignal> }[] {
  const patches: { id: string; patch: Partial<BaySignal> }[] = [];

  // Pass 1: signals missing dataset
  const toAssign = allSignals.filter(s => !s.iec61850_dataset);
  const baseTotal = new Map<string, number>();
  for (const sig of toAssign) {
    const base = suggestDataset(sig.iec61850_ln, sig.iec61850_fc, sig.iec61850_cdc) ?? 'Ev';
    baseTotal.set(base, (baseTotal.get(base) ?? 0) + 1);
  }
  const bucketFill = new Map<string, number>();
  for (const sig of toAssign) {
    const base = suggestDataset(sig.iec61850_ln, sig.iec61850_fc, sig.iec61850_cdc) ?? 'Ev';
    let name = base;
    if ((baseTotal.get(base) ?? 0) >= 100) {
      for (let n = 1; ; n++) {
        const bn = `${base}${n}`;
        if ((bucketFill.get(bn) ?? 0) < maxSize) { bucketFill.set(bn, (bucketFill.get(bn) ?? 0) + 1); name = bn; break; }
      }
    }
    patches.push({ id: sig.id, patch: { iec61850_dataset: name, iec61850_rcb: `r${name}` } });
  }

  // Pass 2: signals with dataset but missing RCB
  for (const sig of allSignals) {
    if (!sig.iec61850_dataset || sig.iec61850_rcb) continue;
    patches.push({ id: sig.id, patch: { iec61850_rcb: `r${sig.iec61850_dataset}` } });
  }

  return patches;
}

function correctDatasets(allSignals: BaySignal[]): { id: string; patch: Partial<BaySignal>; from: string }[] {
  const corrections: { id: string; patch: Partial<BaySignal>; from: string }[] = [];
  for (const sig of allSignals) {
    if (!sig.iec61850_dataset) continue;
    const suggested = suggestDataset(sig.iec61850_ln, sig.iec61850_fc, sig.iec61850_cdc);
    if (!suggested) continue;
    // Check if current dataset base matches suggestion (strip trailing number)
    const currentBase = sig.iec61850_dataset.replace(/\d+$/, '');
    if (currentBase === suggested) continue;
    // Wrong category — suggest correction
    const name = suggested; // simplified: no bucket splitting for corrections
    corrections.push({ id: sig.id, from: sig.iec61850_dataset, patch: { iec61850_dataset: name, iec61850_rcb: `r${name}` } });
  }
  return corrections;
}

interface Props {
  signals: BaySignal[];
  equipment: Equipment[];
  library?: SignalLibraryEntry[];
  states?: SignalState[];
  bayDisplayId?: string;
  reviewMode?: boolean;
  iedModels?: Map<string, IedFcda[]>;
  maxDatasetSize?: number;
  onUpdate: (signalId: string, patch: Partial<BaySignal>) => void;
  onBatchUpdate?: (patches: { id: string; patch: Partial<BaySignal> }[]) => void;
  onDelete?: (signalId: string) => void;
  onBatchDelete?: (ids: string[]) => void;
  onDuplicate?: (ids: string[], at: number, count: number) => void;
  onReorder?: (newOrder: string[]) => void;
  onImmediateSave?: () => Promise<void>;
  hideToolbar?: boolean;
  showFatSat?: boolean;
}

const SOURCE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: 'IED', label: 'IED' },
  { value: 'HARDWIRED', label: 'Harðvíraður' },
];

const EQ_TYPE_ORDER: Record<string, number> = { Aflrofi: 0, Skilrofi: 1, Jarðrofi: 2, Spennir: 3, Vörn: 4, Stjórnbúnaður: 5, Annað: 6 };

const normSearch = (s: string) => s.toLowerCase()
  .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o')
  .replace(/ú/g, 'u').replace(/ý/g, 'y').replace(/ð/g, 'd').replace(/þ/g, 'th')
  .replace(/æ/g, 'ae').replace(/ö/g, 'o');

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

const eInput: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  padding: '3px 5px',
  fontSize: '11px',
  fontFamily: 'monospace',
  width: '100%',
  outline: 'none',
};

const eSelect: React.CSSProperties = {
  background: 'var(--surface-alt)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  padding: '2px 4px',
  fontSize: '11px',
  width: '100%',
  outline: 'none',
  cursor: 'pointer',
};

const onFocus = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = 'var(--accent)');
const onBlurReset = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = 'transparent');

function SignalTableInner({ signals, equipment, library = [], states = [], bayDisplayId = '', iedModels, maxDatasetSize = 1000, onUpdate, onBatchUpdate, onDelete, onBatchDelete, onDuplicate, onReorder, onImmediateSave, hideToolbar = false, showFatSat = false }: Props) {
  const libraryIndex = useMemo(() => new Map(library.filter(e => e.code).map(e => [e.code!, e])), [library]);
  const stateIndex = useMemo(() => new Map(states.map(s => [s.id, s])), [states]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stateLang, setStateLang] = useState<'is' | 'en'>('is');
  const [filterEq, setFilterEq] = useState('');
  const [filterText, setFilterText] = useState('');
  const [filterComments, setFilterComments] = useState(false);
  const [filterIecInvalid, setFilterIecInvalid] = useState(false);
  const deferredSearch = useDeferredValue(filterText);
  const [commentSignalId, setCommentSignalId] = useState<string | null>(null);
  const [datasetPreview, setDatasetPreview] = useState<{
    fills: { id: string; patch: Partial<BaySignal>; signalName: string }[];
    corrections: { id: string; patch: Partial<BaySignal>; signalName: string; from: string }[];
  } | null>(null);
  const [includeCorrections, setIncludeCorrections] = useState(false);
  const [fcdaPickerId, setFcdaPickerId] = useState<string | null>(null);
  const [fcdaSearch, setFcdaSearch] = useState('');
  // Block edit state
  const [blockIed, setBlockIed] = useState('');
  const [blockLdInst, setBlockLdInst] = useState('');
  const [blockPrefix, setBlockPrefix] = useState('');
  const [blockLnClass, setBlockLnClass] = useState('');
  const [blockInst, setBlockInst] = useState('');
  const [blockDoName, setBlockDoName] = useState('');
  const [blockDaName, setBlockDaName] = useState('');
  const [blockFc, setBlockFc] = useState('');
  const [blockDataset, setBlockDataset] = useState('');
  const [blockRcb, setBlockRcb] = useState('');
  const [blockDse, setBlockDse] = useState('');
  const [blockEqCode, setBlockEqCode] = useState('');
  const [blockClearFields, setBlockClearFields] = useState<Set<string>>(new Set());
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [duplicateAt, setDuplicateAt] = useState('');
  const [duplicateCount, setDuplicateCount] = useState('1');

  const searchTokens = useMemo(() => normSearch(deferredSearch).split(/\s+/).filter(Boolean), [deferredSearch]);
  const datasetOpts = useMemo(() => ([...new Set(signals.map(s => s.iec61850_dataset).filter(Boolean))].sort()) as string[], [signals]);
  const commentCount = useMemo(() => signals.filter(s => s.review_flagged).length, [signals]);
  const eqCodesInSignals = useMemo(() =>
    [...new Set(signals.map(s => s.equipment_code).filter(Boolean))].sort((a, b) => {
      const ea = equipment.find(e => e.code === a);
      const eb = equipment.find(e => e.code === b);
      const ta = ea?.category === 'ied' ? 7 : (EQ_TYPE_ORDER[ea?.type ?? 'Annað'] ?? 6);
      const tb = eb?.category === 'ied' ? 7 : (EQ_TYPE_ORDER[eb?.type ?? 'Annað'] ?? 6);
      if (ta !== tb) return ta - tb;
      return a.localeCompare(b, 'is');
    }), [signals, equipment]);
  const allEqCodes = useMemo(() =>
    [...equipment].sort((a, b) => {
      const ta = a.category === 'ied' ? 7 : (EQ_TYPE_ORDER[a.type ?? 'Annað'] ?? 6);
      const tb = b.category === 'ied' ? 7 : (EQ_TYPE_ORDER[b.type ?? 'Annað'] ?? 6);
      if (ta !== tb) return ta - tb;
      return a.code.localeCompare(b.code, 'is');
    }).map(e => e.code), [equipment]);
  const iedOptions = useMemo(() => equipment.filter(e => e.category === 'ied'), [equipment]);

  // Per-IED precomputed options — O(IEDs × model_size), not O(signals × model_size)
  const iedBaseOpts = useMemo(() => {
    const map = new Map<string, { ldOpts: string[]; lnOpts: string[]; pfxOpts: string[]; doOpts: string[]; instOpts: string[]; daOpts: string[] }>();
    if (!iedModels) return map;
    for (const [code, model] of iedModels) {
      map.set(code, {
        ldOpts: [...new Set(model.map(f => f.ldInst))].sort(),
        lnOpts: [...new Set(model.map(f => f.lnClass))].sort(),
        pfxOpts: [...new Set(model.map(f => f.prefix).filter(Boolean))].sort(),
        doOpts: [...new Set(model.map(f => f.doName))].sort(),
        instOpts: [...new Set(model.map(f => f.lnInst).filter(Boolean))].sort(),
        daOpts: [...new Set(model.map(f => f.daName).filter(Boolean))].sort(),
      });
    }
    return map;
  }, [iedModels]);

  // Per-IED per-lnClass index — reduces iecInvalidIds from O(signals×model) to O(signals×lnClass_entries)
  const iedLnIndex = useMemo(() => {
    const map = new Map<string, Map<string, IedFcda[]>>();
    if (!iedModels) return map;
    for (const [code, model] of iedModels) {
      const lnMap = new Map<string, IedFcda[]>();
      for (const f of model) {
        const arr = lnMap.get(f.lnClass) ?? [];
        arr.push(f);
        lnMap.set(f.lnClass, arr);
      }
      map.set(code, lnMap);
    }
    return map;
  }, [iedModels]);

  const iecInvalidIds = useMemo(() => {
    if (!iedModels || iedModels.size === 0) return new Set<string>();
    return new Set<string>(
      signals.filter(sig => {
        if (!sig.iec61850_ied || !sig.iec61850_ln) return false;
        const lnMap = iedLnIndex.get(sig.iec61850_ied);
        if (!lnMap) return false;
        const candidates = lnMap.get(sig.iec61850_ln) ?? [];
        return candidates.length === 0 || !candidates.some(f =>
          (!sig.iec61850_ld || f.ldInst === sig.iec61850_ld) &&
          (!sig.iec61850_ln_prefix || f.prefix === sig.iec61850_ln_prefix) &&
          (!sig.iec61850_ln_inst || f.lnInst === sig.iec61850_ln_inst) &&
          (!sig.iec61850_do || f.doName === sig.iec61850_do) &&
          (!sig.iec61850_da || f.daName === sig.iec61850_da)
        );
      }).map(s => s.id)
    );
  }, [signals, iedModels, iedLnIndex]);
  const visibleSignals = useMemo(() => signals.filter(s => {
    if (filterEq && s.equipment_code !== filterEq) return false;
    if (filterComments && !s.review_flagged) return false;
    if (filterIecInvalid && !iecInvalidIds.has(s.id)) return false;
    if (searchTokens.length > 0) {
      const code = [bayDisplayId, s.equipment_code, s.signal_name].filter(Boolean).join('_');
      const lnPart = `${s.iec61850_ln_prefix ?? ''}${s.iec61850_ln ?? ''}${s.iec61850_ln_inst ?? ''}`;
      const doPart = [s.iec61850_do, s.iec61850_da].filter(Boolean).join('.');
      const ref = [s.iec61850_ld, lnPart].filter(Boolean).join('/') + (doPart ? `.${doPart}` : '');
      const stateConcat = `${s.state_id ?? ''}${s.iec61850_ln ?? ''}${s.iec61850_ln_inst ?? ''}`;
      const fields = [
        s.group_label ?? '', s.equipment_code, s.signal_name, code,
        s.name_is, s.name_en ?? '',
        s.iec61850_ied ?? '', s.iec61850_ld ?? '', s.iec61850_ln ?? '',
        s.iec61850_ln_prefix ?? '', s.iec61850_ln_inst ?? '',
        s.iec61850_do ?? '', s.iec61850_da ?? '', s.iec61850_dataset ?? '',
        s.state_id ?? '', ref, stateConcat,
      ].map(normSearch);
      if (!searchTokens.every(t => fields.some(f => f.includes(t)))) return false;
    }
    return true;
  }), [signals, filterEq, filterComments, filterIecInvalid, searchTokens, iecInvalidIds, bayDisplayId]);

  if (signals.length === 0) {
    return (
      <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
        Engin merki í þessum reit.
      </p>
    );
  }

  const allSelected = selected.size === signals.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(signals.map(s => s.id)));
  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const toggleClear = (f: string) => setBlockClearFields(prev => {
    const next = new Set(prev);
    next.has(f) ? next.delete(f) : next.add(f);
    return next;
  });
  const isClear = (f: string) => blockClearFields.has(f);

  const applyBlock = () => {
    const ids = [...selected];
    const patch: Partial<BaySignal> = {};
    if (blockEqCode) patch.equipment_code = blockEqCode;
    if (blockIed) patch.iec61850_ied = blockIed;
    if (isClear('ldInst'))  patch.iec61850_ld           = null;
    else if (blockLdInst  !== '') patch.iec61850_ld      = blockLdInst || null;
    if (isClear('prefix'))  patch.iec61850_ln_prefix     = null;
    else if (blockPrefix  !== '') patch.iec61850_ln_prefix = blockPrefix || null;
    if (isClear('lnClass')) patch.iec61850_ln            = null;
    else if (blockLnClass !== '') patch.iec61850_ln       = blockLnClass || null;
    if (isClear('inst'))    patch.iec61850_ln_inst        = null;
    else if (blockInst    !== '') patch.iec61850_ln_inst  = blockInst || null;
    if (isClear('doName'))  patch.iec61850_do             = null;
    else if (blockDoName  !== '') patch.iec61850_do       = blockDoName || null;
    if (isClear('daName'))  patch.iec61850_da             = null;
    else if (blockDaName  !== '') patch.iec61850_da       = blockDaName || null;
    if (isClear('fc'))      patch.iec61850_fc             = null;
    else if (blockFc      !== '') patch.iec61850_fc       = blockFc || null;
    if (isClear('dataset')) patch.iec61850_dataset        = null;
    else if (blockDataset !== '') patch.iec61850_dataset  = blockDataset || null;
    if (isClear('rcb'))     patch.iec61850_rcb            = null;
    else if (blockRcb     !== '') patch.iec61850_rcb      = blockRcb || null;
    if (isClear('dse'))     patch.iec61850_dataset_entry  = null;
    else if (blockDse     !== '') patch.iec61850_dataset_entry = blockDse || null;
    if (onBatchUpdate) {
      onBatchUpdate(ids.map(id => ({ id, patch })));
    } else {
      ids.forEach(id => onUpdate(id, patch));
    }
    setBlockIed(''); setBlockLdInst(''); setBlockPrefix(''); setBlockLnClass(''); setBlockInst('');
    setBlockDoName(''); setBlockDaName(''); setBlockFc(''); setBlockDataset('');
    setBlockRcb(''); setBlockDse(''); setBlockEqCode('');
    setBlockClearFields(new Set());
    setSelected(new Set());
  };

  const handleRowSelect = (sigId: string, idx: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastSelectedIdx !== null) {
      const from = Math.min(lastSelectedIdx, idx);
      const to = Math.max(lastSelectedIdx, idx);
      setSelected(prev => {
        const n = new Set(prev);
        visibleSignals.slice(from, to + 1).forEach(s => n.add(s.id));
        return n;
      });
    } else if (e.ctrlKey || e.metaKey) {
      toggle(sigId);
      setLastSelectedIdx(idx);
    } else {
      toggle(sigId);
      setLastSelectedIdx(idx);
    }
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId || !onReorder) return;
    const ids = signals.map(s => s.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    const reordered = [...ids];
    reordered.splice(from, 1);
    reordered.splice(to, 0, dragId);
    onReorder(reordered);
    setDragId(null);
    setDragOverId(null);
  };

  const iecInvalidCount = iecInvalidIds.size;
  const blockInputStyle: React.CSSProperties = {
    background: 'var(--surface-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '4px 8px', fontSize: '12px', outline: 'none',
  };
  const blockSelectStyle: React.CSSProperties = { ...blockInputStyle, cursor: 'pointer' };

  return (
    <div>
      {/* Filter */}
      {!hideToolbar && (
      <div style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {eqCodesInSignals.length > 1 && (
          <select
            value={filterEq}
            onChange={e => setFilterEq(e.target.value)}
            style={{
              background: 'var(--surface-alt)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              padding: '4px 8px', fontSize: '12px', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">Allt tæki ({signals.length})</option>
            {eqCodesInSignals.map(code => (
              <option key={code} value={code}>{code} ({signals.filter(s => s.equipment_code === code).length})</option>
            ))}
          </select>
        )}
        <input
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder="Leita í hópur, tæki, merki, kóða, texta..."
          style={{
            background: 'var(--surface-alt)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            padding: '4px 10px', fontSize: '12px', outline: 'none', minWidth: '260px',
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--line)')}
        />
        {commentCount > 0 && (
          <button
            type="button"
            onClick={() => setFilterComments(f => !f)}
            style={{
              fontSize: '12px', padding: '3px 10px', cursor: 'pointer',
              borderRadius: 'var(--radius-sm)', border: `1px solid ${filterComments ? 'var(--danger)' : 'var(--line)'}`,
              background: filterComments ? 'color-mix(in srgb, var(--danger) 12%, transparent)' : 'var(--surface-alt)',
              color: filterComments ? 'var(--danger)' : 'var(--text-secondary)',
              fontWeight: filterComments ? 700 : 400,
            }}
          >💬 {commentCount}</button>
        )}
        {iecInvalidCount > 0 && (
          <button
            type="button"
            onClick={() => setFilterIecInvalid(f => !f)}
            style={{
              fontSize: '12px', padding: '3px 10px', cursor: 'pointer',
              borderRadius: 'var(--radius-sm)', border: `1px solid ${filterIecInvalid ? 'var(--warn, #f59e0b)' : 'var(--line)'}`,
              background: filterIecInvalid ? 'color-mix(in srgb, var(--warn, #f59e0b) 12%, transparent)' : 'var(--surface-alt)',
              color: filterIecInvalid ? 'var(--warn, #f59e0b)' : 'var(--text-secondary)',
              fontWeight: filterIecInvalid ? 700 : 400,
            }}
            title="Sía merki sem eru ekki til í IED módeli"
          >⚠ {iecInvalidCount}</button>
        )}
        {(filterText || filterEq || filterComments || filterIecInvalid) && (
          <button
            type="button"
            onClick={() => { setFilterText(''); setFilterEq(''); setFilterComments(false); setFilterIecInvalid(false); }}
            style={{ fontSize: '12px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >✕ Hreinsa</button>
        )}
        {(filterText || filterEq || filterComments || filterIecInvalid) && (
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {visibleSignals.length} / {signals.length}
          </span>
        )}
        {onBatchUpdate && signals.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const fills = fillDatasets(signals, maxDatasetSize).map(p => ({
                ...p, signalName: signals.find(s => s.id === p.id)!.signal_name,
              }));
              const corrections = correctDatasets(signals).map(c => ({
                ...c, signalName: signals.find(s => s.id === c.id)!.signal_name,
              }));
              setIncludeCorrections(false);
              setDatasetPreview({ fills, corrections });
            }}
            style={{
              marginLeft: 'auto', fontSize: '12px', padding: '4px 10px',
              background: 'transparent', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title="Fylla inn Dataset og RCB fyrir öll merki sem vantar"
          >↻ Fylla Dataset / RCB</button>
        )}
      </div>
      )}
      {/* Block edit toolbar */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)', marginBottom: 'var(--space-3)',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', minWidth: '100%' }}>
            Block edit — {selected.size} merki valin
          </div>
          {/* Tæki */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Tæki
            <select value={blockEqCode} onChange={e => setBlockEqCode(e.target.value)} style={{ ...blockSelectStyle, minWidth: '100px' }}>
              <option value="">— óbreytt —</option>
              {equipment.map(e => <option key={e.id} value={e.code}>{e.code}</option>)}
            </select>
          </label>
          {/* IED */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Tech Key
            <select value={blockIed} onChange={e => setBlockIed(e.target.value)} style={{ ...blockSelectStyle, minWidth: '130px' }}>
              <option value="">— óbreytt —</option>
              {iedOptions.map(e => <option key={e.id} value={e.code}>{e.code}</option>)}
            </select>
          </label>
          {([
            { key: 'ldInst',  label: 'ldInst',  val: blockLdInst,  set: setBlockLdInst,  w: 70  },
            { key: 'prefix',  label: 'Prefix',  val: blockPrefix,  set: setBlockPrefix,  w: 70  },
            { key: 'lnClass', label: 'lnClass', val: blockLnClass, set: setBlockLnClass, w: 70  },
            { key: 'inst',    label: 'lnInst',  val: blockInst,    set: setBlockInst,    w: 55  },
            { key: 'doName',  label: 'doName',  val: blockDoName,  set: setBlockDoName,  w: 70  },
            { key: 'daName',  label: 'daName',  val: blockDaName,  set: setBlockDaName,  w: 70  },
            { key: 'fc',      label: 'FC',      val: blockFc,      set: setBlockFc,      w: 50  },
            { key: 'dataset', label: 'Dataset', val: blockDataset, set: setBlockDataset, w: 100 },
            { key: 'rcb',     label: 'RCB',     val: blockRcb,     set: setBlockRcb,     w: 130 },
            { key: 'dse',     label: 'DSE',     val: blockDse,     set: setBlockDse,     w: 110 },
          ] as { key: string; label: string; val: string; set: (v: string) => void; w: number }[]).map(f => {
            const clearing = isClear(f.key);
            return (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                {f.label}
                <div style={{ display: 'flex', gap: '2px' }}>
                  <input value={clearing ? '' : f.val}
                    onChange={e => { f.set(e.target.value); if (clearing) toggleClear(f.key); }}
                    disabled={clearing}
                    placeholder={clearing ? '— hreinsa —' : '(óbreytt)'}
                    style={{ ...blockInputStyle, fontFamily: 'monospace', width: `${f.w}px`, opacity: clearing ? 0.5 : 1 }} />
                  <button type="button" onClick={() => toggleClear(f.key)} title="Hreinsa svæðið á völdum"
                    style={{ padding: '0 5px', fontSize: '13px', lineHeight: 1, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', flexShrink: 0,
                      background: clearing ? 'var(--danger)' : 'var(--surface-alt)',
                      color: clearing ? '#fff' : 'var(--text-secondary)' }}>×</button>
                </div>
              </label>
            );
          })}
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignSelf: 'flex-end' }}>
            <Button size="sm" onClick={applyBlock}>Nota á valin</Button>
            {onDuplicate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>×</span>
                <input
                  type="number"
                  value={duplicateCount}
                  onChange={e => setDuplicateCount(e.target.value)}
                  placeholder="1"
                  min={1}
                  max={100}
                  style={{ ...blockInputStyle, width: '44px', textAlign: 'center' }}
                  title="Fjöldi afrita"
                />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>í línu</span>
                <input
                  type="number"
                  value={duplicateAt}
                  onChange={e => setDuplicateAt(e.target.value)}
                  placeholder={String(signals.length + 1)}
                  min={1}
                  max={signals.length + 1}
                  style={{ ...blockInputStyle, width: '52px', textAlign: 'center' }}
                />
                <Button size="sm" variant="ghost" onClick={() => {
                  const at = parseInt(duplicateAt) || signals.length + 1;
                  const count = Math.max(1, parseInt(duplicateCount) || 1);
                  onDuplicate([...selected], at, count);
                  setSelected(new Set());
                  setDuplicateAt('');
                  setDuplicateCount('1');
                }}>
                  Afrita valin
                </Button>
              </div>
            )}
            {onBatchDelete && (
              <Button size="sm" variant="danger" onClick={() => {
                if (!confirm(`Eyða ${selected.size} merkjum?`)) return;
                onBatchDelete([...selected]);
                setSelected(new Set());
              }}>Eyða völdum</Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Hætta við</Button>
          </div>
        </div>
      )}

      {/* IS/EN toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 'var(--space-2)' }}>
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
      </div>

      {datasetOpts.length > 0 && (
        <datalist id="dl-dataset">
          {datasetOpts.map(v => <option key={v} value={v} />)}
        </datalist>
      )}
      {library.length > 0 && (
        <datalist id={`dl-lib-${bayDisplayId}`}>
          {library.filter(e => e.code).map(e => (
            <option key={e.code!} value={e.code!}>{e.name_is}</option>
          ))}
        </datalist>
      )}
      {[...iedBaseOpts.entries()].map(([code, opts]) => (
        <React.Fragment key={code}>
          {opts.ldOpts.length > 0 && <datalist id={`dl-ld-${code}`}>{opts.ldOpts.map(v => <option key={v} value={v} />)}</datalist>}
          {opts.lnOpts.length > 0 && <datalist id={`dl-ln-${code}`}>{opts.lnOpts.map(v => <option key={v} value={v} />)}</datalist>}
          {opts.pfxOpts.length > 1 && <datalist id={`dl-pfx-${code}`}>{opts.pfxOpts.map(v => <option key={v} value={v} />)}</datalist>}
          {opts.instOpts.length > 0 && <datalist id={`dl-inst-${code}`}>{opts.instOpts.map(v => <option key={v} value={v} />)}</datalist>}
          {opts.doOpts.length > 0 && <datalist id={`dl-do-${code}`}>{opts.doOpts.map(v => <option key={v} value={v} />)}</datalist>}
          {opts.daOpts.length > 0 && <datalist id={`dl-da-${code}`}>{opts.daOpts.map(v => <option key={v} value={v} />)}</datalist>}
        </React.Fragment>
      ))}
      <div style={{ overflowX: 'auto', ...(!hideToolbar && { overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }) }}>
        <table style={{ width: 'auto', borderCollapse: 'collapse', minWidth: '1700px' }}>
          <thead>
            <tr>
              <th style={head}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer' }} />
              </th>
              <th style={{ ...head, width: '44px' }}></th>
              <th style={{ ...head, width: '80px' }}>Hópur</th>
              {['#', 'Tæki', 'Merki', 'Kóði', 'Texti'].map(h => (
                <th key={h} style={head}>{h}</th>
              ))}
              <th colSpan={2} style={{ ...head, borderLeft: '2px solid var(--line)', textAlign: 'center' }}>Stöður</th>
              {['Alarm', 'Fl.', 'Upprunatengsl'].map(h => (
                <th key={h} style={head}>{h}</th>
              ))}
              <th colSpan={13} style={{ ...head, borderLeft: '2px solid var(--accent)', color: 'var(--accent)', textAlign: 'center' }}>
                IEC 61850
              </th>
              <th style={head}>Fasi</th>
              {showFatSat && (
                <>
                  <th colSpan={3} style={{ ...head, borderLeft: '2px solid var(--success)', color: 'var(--success)', textAlign: 'center' }}>FAT</th>
                  <th colSpan={3} style={{ ...head, borderLeft: '2px solid var(--warn)', color: 'var(--warn)', textAlign: 'center' }}>SAT</th>
                </>
              )}
              {onDelete !== undefined && <th style={head}></th>}
            </tr>
            <tr>
              <th style={{ ...head, top: '33px' }}></th>
              <th style={{ ...head, top: '33px', width: '44px' }}></th>
              <th style={{ ...head, top: '33px', fontSize: '10px' }}></th>
              {['#', 'Tæki', 'Merki', 'Kóði', 'Texti'].map(h => (
                <th key={`s-${h}`} style={{ ...head, top: '33px', fontSize: '10px' }}></th>
              ))}
              {(['Staða', 'Tegund'] as string[]).map((h, i) => (
                <th key={`st2-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--line)' : undefined }}>{h}</th>
              ))}
              {['Alarm', 'Fl.', 'Upprunatengsl'].map(h => (
                <th key={`s-${h}`} style={{ ...head, top: '33px', fontSize: '10px' }}></th>
              ))}
              {(['IED', 'ldInst', 'Prefix', 'lnClass', 'lnInst', 'doName', 'daName', 'FC', 'CDC', 'Dataset', 'RCB', 'DSE', 'Ref.'] as string[]).map((h, i) => (
                <th key={`ii-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--accent)' : undefined }}>{h}</th>
              ))}
              <th style={{ ...head, top: '33px' }}></th>
              {showFatSat && (
                <>
                  {(['✓', 'Niðurstaða', 'Prófari'] as string[]).map((h, i) => (
                    <th key={`fat-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--success)' : undefined }}>{h}</th>
                  ))}
                  {(['✓', 'Niðurstaða', 'Prófari'] as string[]).map((h, i) => (
                    <th key={`sat-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--warn)' : undefined }}>{h}</th>
                  ))}
                </>
              )}
              {onDelete !== undefined && <th style={{ ...head, top: '33px' }}></th>}
            </tr>
          </thead>
          <tbody>
            {visibleSignals.map((sig, i) => {
              const isSelected = selected.has(sig.id);
              const iecInvalid = iecInvalidIds.has(sig.id);
              return (
                <React.Fragment key={sig.id}>
                  {!!sig.group_label && (
                    <tr>
                      <td colSpan={99} style={{
                        padding: '4px 10px',
                        background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                        borderTop: '2px solid var(--accent)',
                        borderBottom: '1px solid var(--accent)',
                        fontWeight: 700,
                        fontSize: '12px',
                        color: 'var(--accent)',
                        letterSpacing: '0.03em',
                      }}>
                        {sig.group_label}
                      </td>
                    </tr>
                  )}
                  <tr
                    draggable={!!onReorder}
                    onDragStart={() => setDragId(sig.id)}
                    onDragOver={e => { e.preventDefault(); setDragOverId(sig.id); }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={() => handleDrop(sig.id)}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                    style={{
                      background: dragOverId === sig.id ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : iecInvalid ? 'color-mix(in srgb, var(--warn, #f59e0b) 12%, transparent)' : sig.review_flagged ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : isSelected ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)',
                      opacity: dragId === sig.id ? 0.4 : 1,
                      cursor: onReorder ? 'grab' : 'default',
                      borderTop: dragOverId === sig.id ? '2px solid var(--accent)' : undefined,
                    }}
                  >
                  <td style={{ ...cell, width: '32px', textAlign: 'center' }}
                    onClick={e => handleRowSelect(sig.id, i, e)}>
                    <input type="checkbox" checked={isSelected} onChange={() => {}} style={{ cursor: 'pointer', pointerEvents: 'none' }} />
                  </td>
                  <td style={{ ...cell, width: '44px', textAlign: 'center' }}>
                    {(() => {
                      const count = (sig.review_comments?.length ?? 0) + ((!sig.review_comments?.length && sig.review_comment) ? 1 : 0);
                      const flagged = sig.review_flagged;
                      return (
                        <button
                          type="button"
                          onClick={() => setCommentSignalId(sig.id)}
                          style={{ position: 'relative', background: 'none', border: flagged ? '1px solid var(--danger)' : count ? '1px solid var(--line)' : '1px solid transparent', borderRadius: 'var(--radius-sm)', padding: '2px 5px', cursor: 'pointer', fontSize: '13px', color: flagged ? 'var(--danger)' : count ? 'var(--text-secondary)' : 'var(--muted)', opacity: (!flagged && !count) ? 0.3 : 1 }}
                          title={count ? `${count} athugasemd${count > 1 ? 'ir' : ''}` : 'Bæta við athugasemd'}
                        >
                          💬{count > 0 && <span style={{ fontSize: '10px', fontWeight: 700, marginLeft: '2px' }}>{count}</span>}
                        </button>
                      );
                    })()}
                  </td>
                  <td style={{ ...cell, width: '80px', padding: '2px 6px' }}>
                    <input
                      style={{
                        ...eInput,
                        width: '100%',
                        fontSize: '11px',
                        color: 'var(--accent)',
                        fontWeight: sig.group_label ? 600 : 400,
                        border: '1px solid var(--line)',
                        background: sig.group_label ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                      }}
                      defaultValue={sig.group_label ?? ''}
                      key={`gl-${sig.id}`}
                      placeholder="hópur..."
                      onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
                      onBlur={e => {
                        e.target.style.borderColor = 'var(--line)';
                        onUpdate(sig.id, { group_label: e.target.value.trim() || null });
                      }}
                      onChange={() => {}}
                    />
                  </td>
                  <td style={{ ...cell, width: '28px' }}>
                    {onReorder ? (
                      <input
                        key={`pos-${sig.id}-${i}`}
                        defaultValue={i + 1}
                        style={{ ...eInput, width: '28px', textAlign: 'center', color: 'var(--muted)', fontSize: '11px' }}
                        onFocus={e => { e.target.select(); e.target.style.borderColor = 'var(--accent)'; }}
                        onBlur={e => {
                          e.target.style.borderColor = 'transparent';
                          const n = parseInt(e.target.value);
                          if (!isNaN(n) && n !== i + 1) {
                            const ids = signals.map(s => s.id);
                            const to = Math.max(0, Math.min(n - 1, ids.length - 1));
                            const reordered = [...ids];
                            reordered.splice(i, 1);
                            reordered.splice(to, 0, sig.id);
                            onReorder(reordered);
                          } else {
                            e.target.value = String(i + 1);
                          }
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        onChange={() => {}}
                      />
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>{i + 1}</span>
                    )}
                  </td>
                  {/* Tæki dropdown */}
                  <td style={{ ...cell, minWidth: '80px' }}>
                    {allEqCodes.length > 0 ? (
                      <select value={sig.equipment_code} onChange={e => onUpdate(sig.id, { equipment_code: e.target.value })} style={eSelect}>
                        {allEqCodes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontFamily: 'monospace', color: 'var(--accent)', fontSize: '11px' }}>{sig.equipment_code}</span>
                    )}
                  </td>
                  <td style={{ ...cell, minWidth: '120px' }}>
                    <input
                      style={{ ...eInput, color: 'var(--accent)' }}
                      defaultValue={sig.signal_name}
                      key={`sn-${sig.id}-${sig.signal_name}`}
                      list={library.length > 0 ? `dl-lib-${bayDisplayId}` : undefined}
                      placeholder="kóði"
                      onFocus={onFocus}
                      onBlur={e => {
                        onBlurReset(e);
                        const newCode = e.target.value.trim();
                        if (newCode === sig.signal_name) return;
                        const entry = libraryIndex.get(newCode);
                        if (entry) {
                          const hasIec = sig.iec61850_ln || sig.iec61850_do || sig.iec61850_da || sig.iec61850_fc || sig.iec61850_cdc || sig.iec61850_dataset;
                          onUpdate(sig.id, {
                            signal_name: newCode,
                            library_id: entry.id,
                            name_is: entry.name_is,
                            name_en: entry.name_en ?? null,
                            is_alarm: entry.is_alarm,
                            alarm_class: entry.alarm_class ?? null,
                            source_type: entry.source_type,
                            state_id: entry.state_id ?? null,
                            ...(!hasIec && {
                              iec61850_ln: entry.iec61850_ln ?? null,
                              iec61850_do: entry.iec61850_do ?? null,
                              iec61850_da: entry.iec61850_da ?? null,
                              iec61850_fc: entry.iec61850_fc ?? null,
                              iec61850_cdc: entry.iec61850_cdc ?? null,
                              iec61850_dataset: entry.iec61850_dataset ?? null,
                            }),
                          });
                        } else {
                          onUpdate(sig.id, { signal_name: newCode });
                        }
                      }}
                      onChange={() => {}}
                    />
                  </td>
                  {/* Kóði — computed identifier */}
                  <td style={{ ...cell, minWidth: '160px' }}>
                    {(() => {
                      const code = [bayDisplayId, sig.equipment_code, sig.signal_name].filter(Boolean).join('_');
                      return (
                        <span
                          title="Smelltu til að afrita"
                          onClick={() => navigator.clipboard?.writeText(code)}
                          style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'copy', whiteSpace: 'nowrap' }}
                        >{code}</span>
                      );
                    })()}
                  </td>
                  <td style={{ ...cell, minWidth: '150px' }}>
                    {stateLang === 'is' ? (
                      <input style={{ ...eInput, fontFamily: 'inherit' }}
                        onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { name_is: e.target.value }); }}
                        onChange={() => {}} defaultValue={sig.name_is} key={`is-${sig.id}-${sig.name_is}`} />
                    ) : (
                      <input style={{ ...eInput, fontFamily: 'inherit' }}
                        onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { name_en: e.target.value || null }); }}
                        onChange={() => {}} defaultValue={sig.name_en ?? ''} key={`en-${sig.id}-${sig.name_en}`} />
                    )}
                  </td>
                  {/* Stöður — texti only */}
                  {(() => {
                    const st = sig.state_id ? stateIndex.get(sig.state_id) : undefined;
                    const ORDER = ['00', '01', '10', '11'] as const;
                    const stateRows = st
                      ? ORDER.map(k => {
                          const stEntry = st.states[k];
                          if (!stEntry) return null;
                          const text = stateLang === 'is' ? stEntry.is : stEntry.en;
                          return { k, text: text ?? k };
                        }).filter(Boolean)
                      : [];
                    return (
                      <>
                        <td style={{ ...cell, borderLeft: '2px solid var(--line)', minWidth: '180px', verticalAlign: 'top', padding: '4px 6px' }}>
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
                        <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>{st?.type ?? '—'}</td>
                      </>
                    );
                  })()}
                  {/* Alarm — per-state checkboxes */}
                  {(() => {
                    const st = sig.state_id ? stateIndex.get(sig.state_id) : undefined;
                    const ORDER = ['00', '01', '10', '11'] as const;
                    const map: StateAlarmMap = sig.state_alarm_map ?? {};

                    const updateStateMap = (key: '00'|'01'|'10'|'11', isAlarm: boolean) => {
                      const current = map[key] ?? { is_alarm: false, is_event: false, alarm_class: null };
                      const updated: StateAlarmMap = { ...map, [key]: { ...current, is_alarm: isAlarm, alarm_class: isAlarm ? (current.alarm_class ?? 1) : null } };
                      onUpdate(sig.id, { state_alarm_map: updated });
                    };

                    const updateAlarmClass = (key: '00'|'01'|'10'|'11', cls: AlarmClass) => {
                      const current = map[key] ?? { is_alarm: false, is_event: false, alarm_class: null };
                      const updated: StateAlarmMap = { ...map, [key]: { ...current, alarm_class: cls } };
                      onUpdate(sig.id, { state_alarm_map: updated });
                    };

                    if (!st) {
                      // No state — simple alarm checkbox
                      return (
                        <>
                          <td style={{ ...cell, textAlign: 'center' }}>
                            <input type="checkbox" checked={sig.is_alarm}
                              onChange={e => onUpdate(sig.id, { is_alarm: e.target.checked, alarm_class: e.target.checked ? (sig.alarm_class ?? 1) : null })}
                              style={{ cursor: 'pointer' }} />
                          </td>
                          <td style={{ ...cell, minWidth: '60px' }}>
                            {sig.is_alarm && (
                              <select value={sig.alarm_class?.toString() ?? '1'}
                                onChange={e => onUpdate(sig.id, { alarm_class: Number(e.target.value) as 1|2|3 })} style={eSelect}>
                                {[['1','F1'],['2','F2'],['3','F3']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                              </select>
                            )}
                          </td>
                        </>
                      );
                    }

                    const alarmRows = ORDER.map(k => {
                      const stEntry = st.states[k];
                      if (!stEntry) return null;
                      const cfg = map[k] ?? { is_alarm: false, is_event: false, alarm_class: null };
                      return { k, cfg };
                    }).filter(Boolean);

                    return (
                      <>
                        <td style={{ ...cell, verticalAlign: 'top', padding: '4px 6px' }}>
                          {alarmRows.map(row => {
                            if (!row) return null;
                            const { k, cfg } = row;
                            return (
                              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', height: '18px' }}>
                                <span style={{ fontFamily: 'monospace', color: 'var(--muted)', fontSize: '10px', minWidth: '22px' }}>{k}</span>
                                <input type="checkbox" checked={cfg.is_alarm}
                                  onChange={e => updateStateMap(k as '00'|'01'|'10'|'11', e.target.checked)}
                                  style={{ cursor: 'pointer', accentColor: 'var(--danger)' }} />
                              </div>
                            );
                          })}
                        </td>
                        <td style={{ ...cell, verticalAlign: 'top', padding: '4px 6px', minWidth: '55px' }}>
                          {alarmRows.map(row => {
                            if (!row) return null;
                            const { k, cfg } = row;
                            return (
                              <div key={k} style={{ height: '18px', marginBottom: '2px', display: 'flex', alignItems: 'center' }}>
                                {cfg.is_alarm ? (
                                  <select value={cfg.alarm_class?.toString() ?? '1'}
                                    onChange={e => updateAlarmClass(k as '00'|'01'|'10'|'11', Number(e.target.value) as AlarmClass)}
                                    style={{ ...eSelect, width: '44px', padding: '1px 2px', fontSize: '10px' }}>
                                    {[['1','F1'],['2','F2'],['3','F3']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                                  </select>
                                ) : <span style={{ color: 'var(--muted)', fontSize: '10px' }}>—</span>}
                              </div>
                            );
                          })}
                        </td>
                      </>
                    );
                  })()}
                  <td style={{ ...cell, minWidth: '100px' }}>
                    <select value={sig.source_type} onChange={e => onUpdate(sig.id, { source_type: e.target.value as SourceType })} style={eSelect}>
                      {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  {/* IEC 61850 — IED */}
                  <td style={{ ...cell, minWidth: '130px', borderLeft: '2px solid var(--accent)', position: 'relative' }}>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                      {iedOptions.length > 0 ? (
                        <select value={sig.iec61850_ied ?? ''} onChange={e => onUpdate(sig.id, { iec61850_ied: e.target.value || null })} style={eSelect}>
                          <option value="">—</option>
                          {iedOptions.map(e => <option key={e.id} value={e.code}>{e.code}</option>)}
                        </select>
                      ) : (
                        <input style={eInput} defaultValue={sig.iec61850_ied ?? ''} key={`ied-${sig.id}`}
                          placeholder="Q0IED" onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { iec61850_ied: e.target.value || null }); }}
                          onChange={() => {}} />
                      )}
                      {sig.iec61850_ied && iedModels?.has(sig.iec61850_ied) && (
                        <button type="button" onClick={() => { const opening = fcdaPickerId !== sig.id; setFcdaPickerId(opening ? sig.id : null); setFcdaSearch(opening ? `${sig.iec61850_ln_prefix ?? ''}${sig.iec61850_ln ?? ''}` : ''); }}
                          style={{ flexShrink: 0, background: fcdaPickerId === sig.id ? 'var(--accent)' : 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: '3px', cursor: 'pointer', padding: '2px 4px', fontSize: '11px', color: fcdaPickerId === sig.id ? '#fff' : 'var(--text-secondary)' }}
                          title="Velja úr módeli">≡</button>
                      )}
                    </div>
                    {/* FCDA picker dropdown */}
                    {fcdaPickerId === sig.id && sig.iec61850_ied && iedModels?.has(sig.iec61850_ied) && (() => {
                      const model = iedModels.get(sig.iec61850_ied)!;
                      const q = fcdaSearch.toLowerCase();
                      const filtered = q ? model.filter(f =>
                        f.lnClass.toLowerCase().includes(q) ||
                        f.doName.toLowerCase().includes(q) ||
                        f.daName.toLowerCase().includes(q) ||
                        f.ldInst.toLowerCase().includes(q) ||
                        `${f.prefix}${f.lnClass}${f.lnInst}`.toLowerCase().includes(q)
                      ) : model;
                      return (
                        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', minWidth: '360px', maxHeight: '320px', display: 'flex', flexDirection: 'column' }}>
                          <input autoFocus value={fcdaSearch} onChange={e => setFcdaSearch(e.target.value)}
                            placeholder="Leita... (XCBR, Pos, ST...)"
                            style={{ margin: '6px', padding: '4px 8px', fontSize: '12px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-alt)', color: 'var(--text)', outline: 'none' }} />
                          <div style={{ overflowY: 'auto', flex: 1 }}>
                            {filtered.slice(0, 200).map((f, idx) => {
                              const ref = `${f.ldInst}/${f.prefix}${f.lnClass}${f.lnInst}.${f.doName}${f.daName ? '.'+f.daName : ''}`;
                              return (
                                <div key={idx} onClick={() => {
                                  onUpdate(sig.id, {
                                    iec61850_ld: f.ldInst,
                                    iec61850_ln_prefix: f.prefix || null,
                                    iec61850_ln: f.lnClass,
                                    iec61850_ln_inst: f.lnInst,
                                    iec61850_do: f.doName,
                                    iec61850_da: f.daName || null,
                                    iec61850_fc: f.fc,
                                    iec61850_cdc: f.cdc || null,
                                  });
                                  setFcdaPickerId(null);
                                }} style={{ padding: '4px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '8px' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-focus)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                  <span>{ref}</span>
                                  <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{f.fc}{f.cdc ? ` · ${f.cdc}` : ''}</span>
                                </div>
                              );
                            })}
                            {filtered.length === 0 && <div style={{ padding: '8px 10px', color: 'var(--muted)', fontSize: '12px' }}>Ekkert fannst</div>}
                            {filtered.length > 200 && <div style={{ padding: '4px 10px', color: 'var(--muted)', fontSize: '11px' }}>Sía til að sjá fleiri...</div>}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  {/* ldInst + Prefix + lnClass + lnInst + doName + daName — datalists shared per IED, not per signal */}
                  {(() => {
                    const ied = sig.iec61850_ied;
                    const model = ied ? iedModels?.get(ied) : undefined;
                    const opts = ied ? iedBaseOpts.get(ied) : undefined;
                    const ldOptsForLn = (ln: string) => model ? [...new Set(model.filter(f => f.lnClass === ln).map(f => f.ldInst))] : [];
                    const pfxOptsForLn = (ln: string) => model ? [...new Set(model.filter(f => f.lnClass === ln).map(f => f.prefix))] : [];
                    return (
                      <>
                        <td style={{ ...cell, minWidth: '85px' }}>
                          <input style={eInput} defaultValue={sig.iec61850_ld ?? ''} key={`ld-${sig.id}-${sig.iec61850_ld}`}
                            list={opts?.ldOpts.length ? `dl-ld-${ied}` : undefined}
                            onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { iec61850_ld: e.target.value || null }); }}
                            onChange={() => {}} />
                        </td>
                        {/* Prefix */}
                        <td style={{ ...cell, minWidth: '65px' }}>
                          <input style={eInput} defaultValue={sig.iec61850_ln_prefix ?? ''} key={`pfx-${sig.id}-${sig.iec61850_ln_prefix}`}
                            list={(opts?.pfxOpts.length ?? 0) > 1 ? `dl-pfx-${ied}` : undefined}
                            onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { iec61850_ln_prefix: e.target.value || null }); }}
                            onChange={() => {}} />
                        </td>
                        {/* lnClass */}
                        <td style={{ ...cell, minWidth: '75px' }}>
                          <input style={eInput} defaultValue={sig.iec61850_ln ?? ''} key={`ln-${sig.id}-${sig.iec61850_ln}`}
                            list={opts?.lnOpts.length ? `dl-ln-${ied}` : undefined}
                            onFocus={onFocus} onBlur={e => {
                              onBlurReset(e);
                              const ln = e.target.value || null;
                              const patch: Partial<BaySignal> = { iec61850_ln: ln };
                              if (ln && model) {
                                const lds = ldOptsForLn(ln);
                                if (lds.length === 1) patch.iec61850_ld = lds[0] || null;
                                const pfxs = pfxOptsForLn(ln);
                                if (pfxs.length === 1) patch.iec61850_ln_prefix = pfxs[0] || null;
                              }
                              onUpdate(sig.id, patch);
                            }}
                            onChange={() => {}} />
                        </td>
                        {/* lnInst */}
                        <td style={{ ...cell, minWidth: '50px' }}>
                          <input style={eInput} defaultValue={sig.iec61850_ln_inst ?? ''} key={`inst-${sig.id}-${sig.iec61850_ln_inst}`}
                            list={opts?.instOpts.length ? `dl-inst-${ied}` : undefined}
                            placeholder="1" onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { iec61850_ln_inst: e.target.value || null }); }}
                            onChange={() => {}} />
                        </td>
                        {/* doName */}
                        <td style={{ ...cell, minWidth: '80px' }}>
                          <input style={eInput} defaultValue={sig.iec61850_do ?? ''} key={`do-${sig.id}-${sig.iec61850_do}`}
                            list={opts?.doOpts.length ? `dl-do-${ied}` : undefined}
                            onFocus={onFocus} onBlur={e => {
                              onBlurReset(e);
                              const doName = e.target.value || null;
                              const patch: Partial<BaySignal> = { iec61850_do: doName };
                              if (doName && model) {
                                const match = model.find(f =>
                                  (!sig.iec61850_ld || f.ldInst === sig.iec61850_ld) &&
                                  (!sig.iec61850_ln || f.lnClass === sig.iec61850_ln) &&
                                  (!sig.iec61850_ln_prefix || f.prefix === sig.iec61850_ln_prefix) &&
                                  f.doName === doName
                                );
                                if (match?.cdc) patch.iec61850_cdc = match.cdc;
                              }
                              onUpdate(sig.id, patch);
                            }}
                            onChange={() => {}} />
                        </td>
                        {/* daName */}
                        <td style={{ ...cell, minWidth: '80px' }}>
                          <input style={eInput} defaultValue={sig.iec61850_da ?? ''} key={`da-${sig.id}-${sig.iec61850_da}`}
                            list={opts?.daOpts.length ? `dl-da-${ied}` : undefined}
                            onFocus={onFocus} onBlur={e => {
                              onBlurReset(e);
                              const daName = e.target.value || null;
                              const patch: Partial<BaySignal> = { iec61850_da: daName };
                              if (daName && model) {
                                const match = model.find(f =>
                                  (!sig.iec61850_ld || f.ldInst === sig.iec61850_ld) &&
                                  (!sig.iec61850_ln || f.lnClass === sig.iec61850_ln) &&
                                  (!sig.iec61850_ln_prefix || f.prefix === sig.iec61850_ln_prefix) &&
                                  (!sig.iec61850_do || f.doName === sig.iec61850_do) &&
                                  f.daName === daName
                                );
                                if (match?.fc) patch.iec61850_fc = match.fc;
                                if (match?.cdc) patch.iec61850_cdc = match.cdc;
                              }
                              onUpdate(sig.id, patch);
                            }}
                            onChange={() => {}} />
                        </td>
                      </>
                    );
                  })()}
                  {/* FC */}
                  <td style={{ ...cell, minWidth: '45px' }}>
                    <input style={eInput} defaultValue={sig.iec61850_fc ?? ''} key={`fc-${sig.id}-${sig.iec61850_fc}`}
                      onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { iec61850_fc: e.target.value || null }); }}
                      onChange={() => {}} />
                  </td>
                  {/* CDC */}
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)', minWidth: '50px' }}>{sig.iec61850_cdc ?? '—'}</td>
                  {/* Dataset */}
                  <td style={{ ...cell, minWidth: '90px' }}>
                    <input style={eInput} defaultValue={sig.iec61850_dataset ?? ''} key={`ds-${sig.id}-${sig.iec61850_dataset}`}
                      list="dl-dataset"
                      onFocus={onFocus} onBlur={e => {
                        onBlurReset(e);
                        const ds = e.target.value || null;
                        const patch: Partial<BaySignal> = { iec61850_dataset: ds };
                        if (ds && !sig.iec61850_rcb) patch.iec61850_rcb = `r${ds}`;
                        onUpdate(sig.id, patch);
                      }}
                      onChange={() => {}} />
                  </td>
                  {/* RCB */}
                  <td style={{ ...cell, minWidth: '100px' }}>
                    <input style={eInput} defaultValue={sig.iec61850_rcb ?? ''} key={`rcb-${sig.id}-${sig.iec61850_rcb}`}
                      onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { iec61850_rcb: e.target.value || null }); }}
                      onChange={() => {}} />
                  </td>
                  {/* DSE */}
                  <td style={{ ...cell, minWidth: '100px' }}>
                    <input style={eInput} defaultValue={sig.iec61850_dataset_entry ?? ''} key={`dse-${sig.id}-${sig.iec61850_dataset_entry}`}
                      onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { iec61850_dataset_entry: e.target.value || null }); }}
                      onChange={() => {}} />
                  </td>
                  {/* Composite reference */}
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '10px', color: iecInvalid ? 'var(--warn, #f59e0b)' : 'var(--muted)', whiteSpace: 'nowrap', minWidth: '160px' }}>
                    {(() => {
                      const ied = sig.iec61850_ied;
                      const ld = sig.iec61850_ld;
                      const pfx = sig.iec61850_ln_prefix ?? '';
                      const ln = sig.iec61850_ln ?? '';
                      const inst = sig.iec61850_ln_inst ?? '';
                      const doN = sig.iec61850_do ?? '';
                      const daN = sig.iec61850_da ?? '';
                      if (!ld && !ln && !doN) return '—';
                      const lnPart = `${pfx}${ln}${inst}`;
                      const doPart = [doN, daN].filter(Boolean).join('.');
                      const ref = [ld, lnPart].filter(Boolean).join('/') + (doPart ? `.${doPart}` : '');
                      const fullRef = ied ? `${ied}${ref}` : ref;
                      if (iecInvalid) return <><span title="Ekki til í IED módeli">⚠</span> {fullRef}</>;
                      return fullRef;
                    })()}
                  </td>
                  <td style={{ ...cell, fontSize: '10px', color: 'var(--muted)' }}>{sig.phase_added}</td>
                  {showFatSat && (
                    <>
                      {/* FAT */}
                      <td style={{ ...cell, textAlign: 'center', borderLeft: '2px solid var(--success)' }}>
                        <input type="checkbox" checked={sig.fat_tested ?? false}
                          onChange={e => onUpdate(sig.id, { fat_tested: e.target.checked })}
                          style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ ...cell, minWidth: '60px' }}>
                        <select value={sig.fat_result ?? ''} onChange={e => onUpdate(sig.id, { fat_result: (e.target.value || null) as 'PASS' | 'FAIL' | 'SKIP' | null })}
                          style={{ ...eSelect }}>
                          <option value="">—</option>
                          <option value="PASS">PASS</option>
                          <option value="FAIL">FAIL</option>
                          <option value="SKIP">SKIP</option>
                        </select>
                      </td>
                      <td style={{ ...cell, minWidth: '80px' }}>
                        <input defaultValue={sig.fat_tested_by ?? ''} key={`ftb-${sig.id}-${sig.fat_tested_by}`}
                          onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { fat_tested_by: e.target.value || null }); }}
                          onChange={() => {}} style={{ ...eInput }} />
                      </td>
                      {/* SAT */}
                      <td style={{ ...cell, textAlign: 'center', borderLeft: '2px solid var(--warn)' }}>
                        <input type="checkbox" checked={sig.sat_tested ?? false}
                          onChange={e => onUpdate(sig.id, { sat_tested: e.target.checked })}
                          style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ ...cell, minWidth: '60px' }}>
                        <select value={sig.sat_result ?? ''} onChange={e => onUpdate(sig.id, { sat_result: (e.target.value || null) as 'PASS' | 'FAIL' | 'SKIP' | null })}
                          style={{ ...eSelect }}>
                          <option value="">—</option>
                          <option value="PASS">PASS</option>
                          <option value="FAIL">FAIL</option>
                          <option value="SKIP">SKIP</option>
                        </select>
                      </td>
                      <td style={{ ...cell, minWidth: '80px' }}>
                        <input defaultValue={sig.sat_tested_by ?? ''} key={`stb-${sig.id}-${sig.sat_tested_by}`}
                          onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { sat_tested_by: e.target.value || null }); }}
                          onChange={() => {}} style={{ ...eInput }} />
                      </td>
                    </>
                  )}
                  {onDelete && (
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    <Button variant="danger" size="sm" onClick={() => onDelete(sig.id)}>Eyða</Button>
                  </td>
                  )}
                </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {datasetPreview && (() => {
        const active = includeCorrections
          ? [...datasetPreview.fills, ...datasetPreview.corrections]
          : datasetPreview.fills;
        const cell: React.CSSProperties = { padding: '4px 10px', borderBottom: '1px solid var(--line-muted)', fontFamily: 'monospace', fontSize: '12px' };
        const head: React.CSSProperties = { padding: '5px 10px', background: 'var(--surface-alt)', borderBottom: '1px solid var(--line)', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '12px' };
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', width: '560px', maxWidth: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Fylla Dataset / RCB</h3>
                <button type="button" onClick={() => setDatasetPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-secondary)' }}>✕</button>
              </div>

              {datasetPreview.corrections.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={includeCorrections} onChange={e => setIncludeCorrections(e.target.checked)} />
                  Leiðrétta líka ranga flokka ({datasetPreview.corrections.length} merki — t.d. Ev → Meas)
                </label>
              )}

              {active.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Ekkert að gera — öll merki eru rétt stillt.</p>
              ) : (
                <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={head}>Merki</th>
                        <th style={head}>Frá</th>
                        <th style={head}>Í</th>
                        <th style={head}>RCB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {active.map(p => {
                        const from = 'from' in p ? p.from : (signals.find(s => s.id === p.id)?.iec61850_dataset ?? '—');
                        return (
                          <tr key={p.id}>
                            <td style={cell}>{p.signalName}</td>
                            <td style={{ ...cell, color: 'var(--muted)' }}>{String(from)}</td>
                            <td style={{ ...cell, color: 'var(--accent)' }}>{String(p.patch.iec61850_dataset ?? from)}</td>
                            <td style={{ ...cell, color: 'var(--muted)' }}>{String(p.patch.iec61850_rcb ?? '')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button type="button" onClick={() => setDatasetPreview(null)} style={{ padding: '6px 14px', fontSize: '13px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text)' }}>Hætta við</button>
                {active.length > 0 && (
                  <button type="button" onClick={() => { onBatchUpdate!(active.map(p => ({ id: p.id, patch: p.patch }))); setDatasetPreview(null); }}
                    style={{ padding: '6px 14px', fontSize: '13px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                    Beita ({active.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {commentSignalId && (() => {
        const sig = signals.find(s => s.id === commentSignalId);
        if (!sig) return null;
        return (
          <SignalCommentsModal
            signal={sig}
            onUpdate={onUpdate}
            onSave={onImmediateSave}
            onClose={() => setCommentSignalId(null)}
          />
        );
      })()}
    </div>
  );
}

export const SignalTable = memo(SignalTableInner);
