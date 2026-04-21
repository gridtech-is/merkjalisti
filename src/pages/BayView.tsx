// src/pages/BayView.tsx
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { loadBay, saveBay, saveBayTemplate, sendBayForReview, approveBay, rejectBay, type BayFile } from '../services/bayService';
import { useAutoCommit } from '../github/useAutoCommit';
import { Button } from '../components/ui';
import { SignalTable } from '../components/SignalTable';
import { TestingPanel } from '../components/TestingPanel';
import { SignalPickerModal } from '../components/SignalFormModal';
import { ImportSignalsModal } from '../components/ImportSignalsModal';
import { generateSignalTemplate } from '../services/signalTemplate';
import { exportBayToExcel } from '../services/exportService';
import { appendChange } from '../services/changelogService';
import type { BaySignal, Bay, Equipment, Project, SignalLibraryEntry, SignalState } from '../types';
import { createUndoState, undoPush, undoUndo, undoRedo, type UndoState } from '../utils/undoStack';

export function BayView() {
  const { projectId, bayId } = useParams<{ projectId: string; bayId: string }>();
  const { api, userName } = useApi();
  const navigate = useNavigate();
  const [bayFile, setBayFile] = useState<BayFile | null>(null);
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [equipmentSha, setEquipmentSha] = useState('');
  const [signalLibrary, setSignalLibrary] = useState<SignalLibraryEntry[]>([]);
  const [signalStates, setSignalStates] = useState<SignalState[]>([]);
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
      api.readJson<SignalLibraryEntry[]>('data/signal_library.json'),
      api.readJson<SignalState[]>('data/signal_states.json'),
      api.readJson<Project>(`projects/${projectId}/project.json`),
    ]).then(([f, { data: eq, sha: eqSha }, { data: lib }, { data: states }, { data: project }]) => {
      setBayFile(f);
      setUndoState(createUndoState(f.bay.signals));
      setAllEquipment(eq);
      setEquipmentSha(eqSha);
      setSignalLibrary(lib);
      setSignalStates(states);
      setStationNumber(project.station_number);
    }).finally(() => setLoading(false));
  }, [api, projectId, bayId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snapshot = (signals: BaySignal[]) =>
    setUndoState(prev => undoPush(prev, signals));

  const handleAdd = (signals: BaySignal[]) => {
    snapshot(bayFileRef.current?.bay.signals ?? []);
    setBayFile(prev => {
      if (!prev) return prev;
      return { ...prev, bay: { ...prev.bay, signals: [...prev.bay.signals, ...signals] } };
    });
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

  const handleDelete = (signalId: string) => {
    snapshot(bayFileRef.current?.bay.signals ?? []);
    const sig = bayFileRef.current?.bay.signals.find(s => s.id === signalId);
    setBayFile(prev => {
      if (!prev) return prev;
      return { ...prev, bay: { ...prev.bay, signals: prev.bay.signals.filter(s => s.id !== signalId) } };
    });
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
  };

  const handleUpdate = (signalId: string, patch: Partial<BaySignal>) => {
    snapshot(bayFileRef.current?.bay.signals ?? []);
    setBayFile(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        bay: {
          ...prev.bay,
          signals: prev.bay.signals.map(s => s.id === signalId ? { ...s, ...patch } : s),
        },
      };
    });
    setIsDirty(true);
  };

  const handleReorder = (newOrder: string[]) => {
    snapshot(bayFileRef.current?.bay.signals ?? []);
    setBayFile(prev => {
      if (!prev) return prev;
      const map = new Map(prev.bay.signals.map(s => [s.id, s]));
      const reordered = newOrder.map(id => map.get(id)).filter(Boolean) as typeof prev.bay.signals;
      return { ...prev, bay: { ...prev.bay, signals: reordered } };
    });
    setIsDirty(true);
  };

  const handleDuplicate = (ids: string[], at: number) => {
    snapshot(bayFileRef.current?.bay.signals ?? []);
    setBayFile(prev => {
      if (!prev) return prev;
      const copies = prev.bay.signals
        .filter(s => ids.includes(s.id))
        .map(s => ({ ...s, id: crypto.randomUUID(), group_label: null, fat_tested: false, fat_tested_by: null, fat_tested_at: null, sat_tested: false, sat_tested_by: null, sat_tested_at: null }));
      const insertAt = Math.max(0, Math.min(at - 1, prev.bay.signals.length));
      const updated = [...prev.bay.signals];
      updated.splice(insertAt, 0, ...copies);
      return { ...prev, bay: { ...prev.bay, signals: updated } };
    });
    setIsDirty(true);
  };

  const handleUndo = () => {
    setUndoState(prev => {
      const next = undoUndo(prev);
      if (next === prev) return prev;
      setBayFile(bf => bf ? { ...bf, bay: { ...bf.bay, signals: next.present } } : bf);
      setIsDirty(true);
      return next;
    });
  };

  const handleRedo = () => {
    setUndoState(prev => {
      const next = undoRedo(prev);
      if (next === prev) return prev;
      setBayFile(bf => bf ? { ...bf, bay: { ...bf.bay, signals: next.present } } : bf);
      setIsDirty(true);
      return next;
    });
  };

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

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;
  if (!bayFile) return <p style={{ color: 'var(--danger)' }}>Reitur finnst ekki.</p>;

  const { bay } = bayFile;
  const isInReview = bay.status === 'IN_REVIEW';
  const isLocked = bay.status === 'LOCKED';
  const isDraftStatus = bay.status === 'DRAFT';

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}`)}>
          ← {stationNumber} verkefni
        </Button>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--space-6)',
      }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>{bay.display_id}</h1>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
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
              <Button size="sm" variant="ghost" onClick={handleSaveTemplate} disabled={savingTemplate}>⊕ Sniðmát</Button>
              <Button size="sm" variant="ghost" onClick={() => exportBayToExcel(bay)}>↓ Excel</Button>
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
              <Button size="sm" variant="ghost" onClick={handleReject} disabled={reviewSending} style={{ color: 'var(--danger)' }}>✕ Hafna</Button>
              <Button size="sm" onClick={handleApprove} disabled={reviewSending}>✓ Samþykkja</Button>
            </>
          )}

          {isLocked && (
            <>
              <Button size="sm" variant="ghost" onClick={handleSaveTemplate} disabled={savingTemplate}>⊕ Sniðmát</Button>
              <Button size="sm" variant="ghost" onClick={() => exportBayToExcel(bay)}>↓ Excel</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowImport(true)}>↑ Innflutningur</Button>
              <Button size="sm" onClick={() => setShowPicker(true)}>+ Bæta við merki</Button>
              <Button size="sm" onClick={commitChanges} disabled={!isDirty}>Vista núna</Button>
              <Button size="sm" variant="ghost" onClick={() => setTestPhase('FAT')}>FAT</Button>
              <Button size="sm" variant="ghost" onClick={() => setTestPhase('SAT')}>SAT</Button>
            </>
          )}
        </div>
      </div>


      <SignalTable
        signals={bay.signals}
        equipment={allEquipment}
        library={signalLibrary}
        states={signalStates}
        bayDisplayId={bay.display_id}
        reviewMode={isInReview || bay.signals.some(s => s.review_flagged)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        onReorder={handleReorder}
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
            generateSignalTemplate(() =>
              api.readJson<SignalLibraryEntry[]>('data/signal_library.json').then(r => r.data)
            )
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
    </div>
  );
}
