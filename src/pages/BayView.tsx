// src/pages/BayView.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { useLibrary } from '../context/LibraryContext';
import { loadBay, saveBay, saveBayTemplate, sendBayForReview, approveBay, rejectBay, listBays, type BayFile } from '../services/bayService';
import { useAutoCommit } from '../github/useAutoCommit';
import { Button } from '../components/ui';
import { SignalTable } from '../components/SignalTable';
import { TestingPanel } from '../components/TestingPanel';
import { SignalPickerModal } from '../components/SignalFormModal';
import { ImportSignalsModal } from '../components/ImportSignalsModal';
import { generateSignalTemplate } from '../services/signalTemplate';
import { exportBayToExcel, exportZenonBay } from '../services/exportService';
import { appendChange } from '../services/changelogService';
import type { BaySignal, Bay, Equipment, EquipmentTemplate, Project, IedFcda } from '../types';
import { loadIedModel } from '../services/iedModelService';
import { listEquipmentTemplates } from '../services/equipmentTemplateService';
import { ApplyTemplateModal } from '../components/ApplyTemplateModal';
import { createUndoState, undoPush, undoUndo, undoRedo, type UndoState } from '../utils/undoStack';

export function BayView() {
  const { projectId, bayId } = useParams<{ projectId: string; bayId: string }>();
  const { api, userName } = useApi();
  const { signalLibrary, signalStates, loading: libLoading } = useLibrary();
  const navigate = useNavigate();
  const [bayFile, setBayFile] = useState<BayFile | null>(null);
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [equipmentSha, setEquipmentSha] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [testPhase, setTestPhase] = useState<'FAT' | 'SAT' | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [reviewSending, setReviewSending] = useState(false);
  const [stationNumber, setStationNumber] = useState<string>('');
  const [undoState, setUndoState] = useState<UndoState<BaySignal[]>>(() => createUndoState([]));
  const [iedModels, setIedModels] = useState<Map<string, IedFcda[]>>(new Map());
  const [signalTemplates, setSignalTemplates] = useState<EquipmentTemplate[]>([]);
  const [applyTemplateIed, setApplyTemplateIed] = useState<Equipment | null>(null);
  const [renamingBay, setRenamingBay] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [bayList, setBayList] = useState<Bay[]>([]);

  const bayFileRef = useRef<BayFile | null>(null);
  const allEquipmentRef = useRef<Equipment[]>([]);
  const equipmentShaRef = useRef<string>('');
  bayFileRef.current = bayFile;
  allEquipmentRef.current = allEquipment;
  equipmentShaRef.current = equipmentSha;

  useEffect(() => {
    if (!projectId || !bayId) return;
    Promise.all([
      loadBay(api, projectId, bayId),
      api.readJson<Equipment[]>(`projects/${projectId}/equipment.json`),
      api.readJson<Project>(`projects/${projectId}/project.json`),
    ]).then(([f, { data: eq, sha: eqSha }, { data: project }]) => {
      setBayFile(f);
      setUndoState(createUndoState(f.bay.signals));
      setAllEquipment(eq);
      setEquipmentSha(eqSha);
      setStationNumber(project.station_number);
      // Load IED models for all IED equipment
      const ieds = eq.filter(e => e.category === 'ied');
      Promise.all(ieds.map(async e => {
        const model = await loadIedModel(api, projectId!, e.id);
        return { code: e.code, model };
      })).then(results => {
        const map = new Map<string, IedFcda[]>();
        results.forEach(({ code, model }) => { if (model) map.set(code, model); });
        setIedModels(map);
      });
    }).finally(() => setLoading(false));
    listEquipmentTemplates(api).then(setSignalTemplates).catch(() => {});
  }, [api, projectId, bayId]);

  useEffect(() => {
    if (!projectId) return;
    listBays(api, projectId).then(setBayList).catch(() => {});
  }, [api, projectId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndoRef.current();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedoRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = (signals: BaySignal[]) => {
    const before = bayFileRef.current?.bay.signals ?? [];
    const after = [...before, ...signals];
    setUndoState(prev => undoPush(prev, after));
    setBayFile(prev => prev ? { ...prev, bay: { ...prev.bay, signals: after } } : prev);
    setIsDirty(true);
    setShowPicker(false);
    signals.forEach(sig => {
      appendChange(api, projectId!, {
        user: userName,
        phase: 'DESIGN',
        type: 'SIGNAL_ADDED',
        target_id: sig.id,
        target_type: 'signal',
        field: null,
        old_value: null,
        new_value: `${sig.equipment_code}_${sig.signal_name}`,
        comment: `Merki bætt við: ${sig.signal_name} í ${bayFileRef.current?.bay.display_id}`,
      });
    });
  };

  const handleDelete = useCallback((signalId: string) => {
    const before = bayFileRef.current?.bay.signals ?? [];
    const sig = before.find(s => s.id === signalId);
    const after = before.filter(s => s.id !== signalId);
    setUndoState(prev => undoPush(prev, after));
    setBayFile(prev => prev ? { ...prev, bay: { ...prev.bay, signals: after } } : prev);
    setIsDirty(true);
    if (sig) {
      appendChange(api, projectId!, {
        user: userName,
        phase: 'DESIGN',
        type: 'SIGNAL_REMOVED',
        target_id: signalId,
        target_type: 'signal',
        field: null,
        old_value: `${sig.equipment_code}_${sig.signal_name}`,
        new_value: null,
        comment: `Merki eytt: ${sig.signal_name}`,
      });
    }
  }, [api, projectId, userName]);

  const handleUpdate = useCallback((signalId: string, patch: Partial<BaySignal>) => {
    const before = bayFileRef.current?.bay.signals ?? [];
    const oldSig = before.find(s => s.id === signalId);
    const after = before.map(s => s.id === signalId ? { ...s, ...patch } : s);
    setUndoState(prev => undoPush(prev, after));
    setBayFile(prev => prev ? { ...prev, bay: { ...prev.bay, signals: after } } : prev);
    setIsDirty(true);

    if (oldSig && projectId) {
      for (const [field, newVal] of Object.entries(patch) as [string, unknown][]) {
        const oldVal = (oldSig as unknown as Record<string, unknown>)[field];
        if (oldVal === newVal) continue;
        if (typeof oldVal === 'object' || typeof newVal === 'object') continue;
        appendChange(api, projectId, {
          user: userName,
          phase: 'DESIGN',
          type: 'FIELD_CHANGED',
          target_id: signalId,
          target_type: 'signal',
          target_parent_id: bayId ?? null,
          field,
          old_value: oldVal != null ? String(oldVal) : null,
          new_value: newVal != null ? String(newVal) : null,
          comment: `${field} breytt`,
        });
      }
    }
  }, [api, projectId, bayId, userName]);

  const handleBatchDelete = useCallback((ids: string[]) => {
    const before = bayFileRef.current?.bay.signals ?? [];
    const toDelete = before.filter(s => ids.includes(s.id));
    const after = before.filter(s => !ids.includes(s.id));
    setUndoState(prev => undoPush(prev, after));
    setBayFile(prev => prev ? { ...prev, bay: { ...prev.bay, signals: after } } : prev);
    setIsDirty(true);
    toDelete.forEach(sig => {
      appendChange(api, projectId!, {
        user: userName, phase: 'DESIGN', type: 'SIGNAL_REMOVED',
        target_id: sig.id, target_type: 'signal',
        field: null, old_value: `${sig.equipment_code}_${sig.signal_name}`, new_value: null,
        comment: `Merki eytt (block): ${sig.signal_name}`,
      });
    });
  }, [api, projectId, userName]);

  const handleBatchUpdate = useCallback((patches: { id: string; patch: Partial<BaySignal> }[]) => {
    const before = bayFileRef.current?.bay.signals ?? [];
    let after = before;
    for (const { id, patch } of patches) {
      after = after.map(s => s.id === id ? { ...s, ...patch } : s);
    }
    setUndoState(prev => undoPush(prev, after));
    setBayFile(prev => prev ? { ...prev, bay: { ...prev.bay, signals: after } } : prev);
    setIsDirty(true);
    if (projectId) {
      for (const { id, patch } of patches) {
        const oldSig = before.find(s => s.id === id);
        if (!oldSig) continue;
        for (const [field, newVal] of Object.entries(patch) as [string, unknown][]) {
          const oldVal = (oldSig as unknown as Record<string, unknown>)[field];
          if (oldVal === newVal) continue;
          if (typeof oldVal === 'object' || typeof newVal === 'object') continue;
          appendChange(api, projectId, {
            user: userName,
            phase: 'DESIGN',
            type: 'FIELD_CHANGED',
            target_id: id,
            target_type: 'signal',
            target_parent_id: bayId ?? null,
            field,
            old_value: oldVal != null ? String(oldVal) : null,
            new_value: newVal != null ? String(newVal) : null,
            comment: `${field} breytt`,
          });
        }
      }
    }
  }, [api, projectId, bayId, userName]);

  const EQ_TYPE_ORDER: Record<string, number> = { Aflrofi: 0, Skilrofi: 1, Jarðrofi: 2, Spennir: 3, Vörn: 4, Stjórnbúnaður: 5, Annað: 6 };
  const handleSortByType = () => {
    const signals = bayFileRef.current?.bay.signals ?? [];
    const eqMap = new Map(allEquipmentRef.current.map(e => [e.code, e]));
    const sorted = [...signals].sort((a, b) => {
      const ea = eqMap.get(a.equipment_code);
      const eb = eqMap.get(b.equipment_code);
      const ta = ea?.category === 'ied' ? 7 : (EQ_TYPE_ORDER[ea?.type ?? 'Annað'] ?? 6);
      const tb = eb?.category === 'ied' ? 7 : (EQ_TYPE_ORDER[eb?.type ?? 'Annað'] ?? 6);
      if (ta !== tb) return ta - tb;
      const codeComp = a.equipment_code.localeCompare(b.equipment_code, 'is');
      if (codeComp !== 0) return codeComp;
      return a.signal_name.localeCompare(b.signal_name, 'is');
    });
    handleReorder(sorted.map(s => s.id));
  };

  const handleReorder = useCallback((newOrder: string[]) => {
    const before = bayFileRef.current?.bay.signals ?? [];
    const map = new Map(before.map(s => [s.id, s]));
    const after = newOrder.map(id => map.get(id)).filter(Boolean) as typeof before;
    setUndoState(prev => undoPush(prev, after));
    setBayFile(prev => prev ? { ...prev, bay: { ...prev.bay, signals: after } } : prev);
    setIsDirty(true);
  }, []);

  const handleDuplicate = useCallback((ids: string[], at: number, count = 1) => {
    const before = bayFileRef.current?.bay.signals ?? [];
    const originals = before.filter(s => ids.includes(s.id));
    const copies = Array.from({ length: count }, () =>
      originals.map(s => ({
        ...s,
        id: crypto.randomUUID(),
        group_label: null,
        fat_tested: false, fat_tested_by: null, fat_tested_at: null, fat_result: null,
        sat_tested: false, sat_tested_by: null, sat_tested_at: null, sat_result: null,
      }))
    ).flat();
    const insertAt = Math.max(0, Math.min(at - 1, before.length));
    const after = [...before];
    after.splice(insertAt, 0, ...copies);
    setUndoState(prev => undoPush(prev, after));
    setBayFile(prev => prev ? { ...prev, bay: { ...prev.bay, signals: after } } : prev);
    setIsDirty(true);
  }, []);

  const handleUndoRef = useRef<() => void>(() => {});
  const handleRedoRef = useRef<() => void>(() => {});

  const handleUndo = () => {
    const next = undoUndo(undoState);
    if (next === undoState) return;
    setUndoState(next);
    setBayFile(bf => bf ? { ...bf, bay: { ...bf.bay, signals: next.present } } : bf);
    setIsDirty(true);
  };

  const handleRedo = () => {
    const next = undoRedo(undoState);
    if (next === undoState) return;
    setUndoState(next);
    setBayFile(bf => bf ? { ...bf, bay: { ...bf.bay, signals: next.present } } : bf);
    setIsDirty(true);
  };

  handleUndoRef.current = handleUndo;
  handleRedoRef.current = handleRedo;

  const commitChanges = async () => {
    const current = bayFileRef.current;
    if (!current || !projectId) return;

    let bayToSave = current;
    if (current.bay.status === 'LOCKED') {
      const clearedBay: Bay = {
        ...current.bay,
        status: 'DRAFT',
        signals: current.bay.signals.map(s => ({
          ...s,
          review_flagged: false,
          review_comment: null,
        })),
      };
      bayToSave = { ...current, bay: clearedBay };
      // Don't call setBayFile here — wait until after successful save
    }

    const updated = await saveBay(api, projectId, bayToSave, bayToSave.bay.status);
    setBayFile(updated);
    setIsDirty(false);
    setLastSaved(new Date());

    // Log LOCKED→DRAFT transition only after successful save
    if (current.bay.status === 'LOCKED') {
      await appendChange(api, projectId, {
        user: userName, phase: 'DESIGN', type: 'PHASE_CHANGED',
        target_id: current.bay.id, target_type: 'bay',
        field: null, old_value: 'LOCKED', new_value: 'DRAFT',
        comment: `Reitur opnaður aftur eftir læsingu: ${current.bay.display_id}`,
      });
    }
  };

  useAutoCommit(isDirty, commitChanges);

  const handleSaveRename = async () => {
    if (!bayFile || !projectId) return;
    const newDesc = descDraft.trim() || null;
    setRenameSaving(true);
    try {
      const updated: Bay = { ...bayFile.bay, description: newDesc };
      const saved = await saveBay(api, projectId, { bay: updated, sha: bayFile.sha }, bayFile.bay.status === 'DRAFT' ? 'DRAFT' : 'DESIGN');
      setBayFile(saved);
      setRenamingBay(false);
    } finally { setRenameSaving(false); }
  };

  const handleSaveTemplate = async () => {
    if (!bayFile) return;
    const name = prompt('Nafn á sniðmáti:', bayFile.bay.display_id);
    if (!name) return;
    setSavingTemplate(true);
    try {
      await saveBayTemplate(api, bayFile.bay, name);
      alert(`Sniðmát "${name}" vistað.`);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSendForReview = async () => {
    const current = bayFileRef.current;
    if (!current || !projectId) return;
    if (!confirm(`Senda "${current.bay.display_id}" í yfirferð? Reiturinn verður læstur þar til yfirferð lýkur.`)) return;
    setReviewSending(true);
    try {
      const updated = await sendBayForReview(api, projectId, current, userName);
      setBayFile(updated);
      setIsDirty(false);
    } catch {
      alert('Villa við að senda í yfirferð. Reyndu aftur.');
    } finally {
      setReviewSending(false);
    }
  };

  const handleApprove = async () => {
    const current = bayFileRef.current;
    if (!current || !projectId) return;
    setReviewSending(true);
    try {
      const raw = prompt('Athugasemd (valkvæmt):');
      if (raw === null) return;
      const comment = raw.trim() || null;
      const updated = await approveBay(api, projectId, current, userName, comment);
      setBayFile(updated);
    } catch {
      alert('Villa við samþykki. Reyndu aftur.');
    } finally {
      setReviewSending(false);
    }
  };

  const handleReject = async () => {
    const current = bayFileRef.current;
    if (!current || !projectId) return;
    setReviewSending(true);
    try {
      const comment = prompt('Ástæða hafnunar (nauðsynlegt):');
      if (!comment?.trim()) return;
      const updated = await rejectBay(api, projectId, current, userName, comment.trim());
      setBayFile(updated);
    } catch {
      alert('Villa við höfnun. Reyndu aftur.');
    } finally {
      setReviewSending(false);
    }
  };

  const navigateAway = async (path: string) => {
    if (isDirty) {
      try { await commitChanges(); } catch { /* vista mistókst — farðu samt */ }
    }
    navigate(path);
  };

  if (loading || libLoading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;
  if (!bayFile) return <p style={{ color: 'var(--danger)' }}>Reitur finnst ekki.</p>;

  const { bay } = bayFile;
  const isInReview = bay.status === 'IN_REVIEW';
  const isLocked = bay.status === 'LOCKED';
  const isDraftStatus = bay.status === 'DRAFT';

  return (
    <div>
      {/* Bay tab strip */}
      {bayList.length > 1 && (
        <div style={{
          display: 'flex', overflowX: 'auto', gap: '2px',
          borderBottom: '1px solid var(--line)',
          marginBottom: 'var(--space-4)',
          paddingBottom: '0',
        }}>
          {bayList.map(b => {
            const isCurrent = b.id === bayId;
            const flagCount = b.signals.filter(s => s.review_flagged).length;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => navigateAway(`/projects/${projectId}/bays/${b.id}`)}
                style={{
                  flexShrink: 0,
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: isCurrent ? 700 : 400,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  borderBottom: isCurrent ? '2px solid var(--accent)' : '2px solid transparent',
                  color: isCurrent ? 'var(--accent)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  marginBottom: '-1px',
                }}
              >
                {b.display_id}
                {flagCount > 0 && (
                  <span style={{ marginLeft: '5px', fontSize: '10px', color: 'var(--danger)', fontWeight: 700 }}>💬{flagCount}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ marginBottom: 'var(--space-2)' }}>
        <Button variant="ghost" size="sm" onClick={() => navigateAway(`/projects/${projectId}`)}>
          ← {stationNumber} verkefni
        </Button>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--space-6)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>{bay.display_id}</h1>
            <button type="button"
              onClick={() => { setDescDraft(bay.description ?? ''); setRenamingBay(true); }}
              title="Lýsing"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '13px', padding: '2px 4px', lineHeight: 1 }}>✏</button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            {bay.description && <span style={{ marginRight: '8px', color: 'var(--text-secondary)' }}>{bay.description}</span>}
            {stationNumber} / {bay.voltage_level} / {bay.bay_name} — {bay.signals.length} merki
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Status badge */}
          {!isDraftStatus && (
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              background: isInReview ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'color-mix(in srgb, var(--success) 20%, transparent)',
              color: isInReview ? 'var(--accent)' : 'var(--success)',
              border: `1px solid ${isInReview ? 'var(--accent)' : 'var(--success)'}`,
            }}>
              {isInReview
                ? `Í YFIRFERÐ — sent af ${bay.review?.sent_by ?? ''} ${bay.review?.sent_at ? new Date(bay.review.sent_at).toLocaleDateString('is-IS') : ''}`
                : `LÆST — samþykkt af ${bay.review?.reviewed_by ?? ''} ${bay.review?.reviewed_at ? new Date(bay.review.reviewed_at).toLocaleDateString('is-IS') : ''}`
              }
            </span>
          )}

          {isDirty && <span style={{ fontSize: '12px', color: 'var(--warn)' }}>● Óvistað</span>}
          {lastSaved && !isDirty && (
            <span style={{ fontSize: '12px', color: 'var(--success)' }}>
              ✓ Vistað {lastSaved.toLocaleTimeString('is-IS')}
            </span>
          )}

          {isDraftStatus && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleUndo}
                disabled={undoState.past.length === 0}
                title="Ctrl+Z"
              >
                ↩ Afturkalla
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRedo}
                disabled={undoState.future.length === 0}
                title="Ctrl+Shift+Z"
              >
                ↪ Endurtaka
              </Button>
              <Button size="sm" variant="ghost" onClick={handleSortByType}>↕ Raða</Button>
              <Button size="sm" variant="ghost" onClick={handleSaveTemplate} disabled={savingTemplate}>⊕ Sniðmát</Button>
              <Button size="sm" variant="ghost" onClick={() => exportBayToExcel(bay)}>↓ Excel</Button>
              <Button size="sm" variant="ghost" onClick={() => exportZenonBay(bay, signalStates)}>↓ zenon</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowImport(true)}>↑ Innflutningur</Button>
              <Button size="sm" onClick={() => setShowPicker(true)}>+ Bæta við merki</Button>
              <Button size="sm" onClick={commitChanges} disabled={!isDirty}>Vista núna</Button>
              <Button size="sm" variant="ghost" onClick={() => setTestPhase('FAT')}>FAT</Button>
              <Button size="sm" variant="ghost" onClick={() => setTestPhase('SAT')}>SAT</Button>
              <Button size="sm" variant="ghost" onClick={handleSendForReview} disabled={reviewSending}>→ Senda í yfirferð</Button>
            </>
          )}

          {isInReview && (
            <>
              <Button size="sm" onClick={() => setShowPicker(true)}>+ Bæta við merki</Button>
              <Button size="sm" variant="ghost" onClick={() => exportBayToExcel(bay)}>↓ Excel</Button>
              <Button size="sm" variant="ghost" onClick={() => exportZenonBay(bay, signalStates)}>↓ zenon</Button>
              <Button size="sm" variant="ghost" onClick={handleReject} disabled={reviewSending} style={{ color: 'var(--danger)' }}>✕ Hafna</Button>
              <Button size="sm" onClick={handleApprove} disabled={reviewSending}>✓ Samþykkja</Button>
            </>
          )}

          {isLocked && (
            <>
              <Button size="sm" variant="ghost" onClick={handleSortByType}>↕ Raða</Button>
              <Button size="sm" variant="ghost" onClick={handleSaveTemplate} disabled={savingTemplate}>⊕ Sniðmát</Button>
              <Button size="sm" variant="ghost" onClick={() => exportBayToExcel(bay)}>↓ Excel</Button>
              <Button size="sm" variant="ghost" onClick={() => exportZenonBay(bay, signalStates)}>↓ zenon</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowImport(true)}>↑ Innflutningur</Button>
              <Button size="sm" onClick={() => setShowPicker(true)}>+ Bæta við merki</Button>
              <Button size="sm" onClick={commitChanges} disabled={!isDirty}>Vista núna</Button>
              <Button size="sm" variant="ghost" onClick={() => setTestPhase('FAT')}>FAT</Button>
              <Button size="sm" variant="ghost" onClick={() => setTestPhase('SAT')}>SAT</Button>
            </>
          )}
        </div>
      </div>


      {/* IED chips */}
      {(() => {
        const bayIeds = allEquipment.filter(eq => eq.category === 'ied' && bay.equipment_ids.includes(eq.id));
        if (bayIeds.length === 0) return null;
        return (
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
            {bayIeds.map(eq => (
              <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid var(--accent)', borderRadius: '999px', fontSize: '12px' }}>
                <span style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>{eq.code}</span>
                {eq.manufacturer && <span style={{ color: 'var(--text-secondary)' }}>{eq.manufacturer}</span>}
                {eq.model && <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '11px' }}>{eq.model}</span>}
                {isDraftStatus && (
                  <button
                    type="button"
                    onClick={() => setApplyTemplateIed(eq)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '11px', padding: '0 2px', fontFamily: 'inherit' }}
                    title="Beita IEC 61850 sniðmáti"
                  >↓ Sniðmát</button>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      <SignalTable
        signals={bay.signals}
        equipment={allEquipment}
        library={signalLibrary}
        states={signalStates}
        bayDisplayId={bay.display_id}
        reviewMode={isInReview || bay.signals.some(s => s.review_flagged)}
        iedModels={iedModels}
        onUpdate={handleUpdate}
        onBatchUpdate={handleBatchUpdate}
        onDelete={handleDelete}
        onBatchDelete={handleBatchDelete}
        onDuplicate={handleDuplicate}
        onReorder={handleReorder}
        onImmediateSave={commitChanges}
      />

      {showPicker && (
        <SignalPickerModal
          phase="DESIGN"
          equipment={allEquipment}
          onAdd={handleAdd}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showImport && (
        <ImportSignalsModal
          phase="DESIGN"
          library={signalLibrary}
          onAdd={(signals) => { handleAdd(signals); setShowImport(false); }}
          onClose={() => setShowImport(false)}
          onDownloadTemplate={() =>
            generateSignalTemplate(() => Promise.resolve(signalLibrary))
          }
        />
      )}

      {testPhase && (
        <TestingPanel
          signals={bay.signals}
          phase={testPhase}
          userName={userName}
          onUpdate={handleUpdate}
          onClose={() => setTestPhase(null)}
        />
      )}

      {applyTemplateIed && bayFile && (
        <ApplyTemplateModal
          ied={applyTemplateIed}
          templates={signalTemplates}
          baySignals={bayFile.bay.signals}
          onApply={(updated, matchedCount) => {
            setBayFile(prev => prev ? { ...prev, bay: { ...prev.bay, signals: updated } } : prev);
            setIsDirty(true);
            alert(`Uppfærði IEC61850 á ${matchedCount} merkjum.`);
          }}
          onClose={() => setApplyTemplateIed(null)}
        />
      )}

      {renamingBay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setRenamingBay(false); }}>
          <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 'var(--space-6)', width: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: 'var(--space-2)' }}>Lýsing á reit</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: 'var(--space-4)', fontFamily: 'monospace' }}>{bay.display_id}</div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Lýsing (valkvæmt)</label>
              <input
                autoFocus
                value={descDraft}
                onChange={e => setDescDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveRename(); if (e.key === 'Escape') setRenamingBay(false); }}
                placeholder="t.d. Meginspennir 1"
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '6px 8px', fontSize: '13px', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <Button variant="ghost" onClick={() => setRenamingBay(false)}>Hætta við</Button>
              <Button onClick={handleSaveRename} disabled={renameSaving}>
                {renameSaving ? 'Vista...' : 'Vista'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
