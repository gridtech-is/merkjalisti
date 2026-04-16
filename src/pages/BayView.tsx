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
import type { BaySignal, Bay, Equipment, SignalLibraryEntry, SignalState } from '../types';

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
    ]).then(([f, { data: eq, sha: eqSha }, { data: lib }, { data: states }]) => {
      setBayFile(f);
      setAllEquipment(eq);
      setEquipmentSha(eqSha);
      setSignalLibrary(lib);
      setSignalStates(states);
    }).finally(() => setLoading(false));
  }, [api, projectId, bayId]);

  const bayEquipment = bayFile
    ? allEquipment.filter(e => bayFile.bay.equipment_ids.includes(e.id))
    : [];

  const toggleEquipment = (eqId: string) => {
    setBayFile(prev => {
      if (!prev) return prev;
      const ids = prev.bay.equipment_ids;
      const next = ids.includes(eqId) ? ids.filter(i => i !== eqId) : [...ids, eqId];
      return { ...prev, bay: { ...prev.bay, equipment_ids: next } };
    });
    setIsDirty(true);
  };

  const handleAdd = (signals: BaySignal[]) => {
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
      setBayFile(bayToSave);
      appendChange(api, projectId, {
        user: userName, phase: 'DESIGN', type: 'PHASE_CHANGED',
        target_id: current.bay.id, target_type: 'bay',
        field: null, old_value: 'LOCKED', new_value: 'DRAFT',
        comment: `Reitur opnaður aftur eftir læsingu: ${current.bay.display_id}`,
      });
    }

    const updated = await saveBay(api, projectId, bayToSave, bayToSave.bay.status);
    setBayFile(updated);
    setIsDirty(false);
    setLastSaved(new Date());
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
    if (!bayFile || !projectId) return;
    if (!confirm(`Senda "${bayFile.bay.display_id}" í yfirferð? Reiturinn verður læstur þar til yfirferð lýkur.`)) return;
    setReviewSending(true);
    try {
      const updated = await sendBayForReview(api, projectId, bayFile, userName);
      setBayFile(updated);
      setIsDirty(false);
    } catch {
      alert('Villa við að senda í yfirferð. Reyndu aftur.');
    } finally {
      setReviewSending(false);
    }
  };

  const handleApprove = async () => {
    if (!bayFile || !projectId) return;
    const comment = prompt('Athugasemd (valkvæmt):') ?? null;
    setReviewSending(true);
    try {
      const updated = await approveBay(api, projectId, bayFile, userName, comment);
      setBayFile(updated);
    } catch {
      alert('Villa við samþykki. Reyndu aftur.');
    } finally {
      setReviewSending(false);
    }
  };

  const handleReject = async () => {
    if (!bayFile || !projectId) return;
    const comment = prompt('Ástæða hafnunar (nauðsynlegt):');
    if (!comment?.trim()) return;
    setReviewSending(true);
    try {
      const updated = await rejectBay(api, projectId, bayFile, userName, comment.trim());
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
          ← {bay.station} verkefni
        </Button>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--space-6)',
      }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>{bay.display_id}</h1>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            {bay.station} / {bay.voltage_level} / {bay.bay_name} — {bay.signals.length} merki
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

      {/* Equipment assignment */}
      {allEquipment.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          {(['apparatus', 'ied'] as const).map(cat => {
            const group = allEquipment.filter(e => cat === 'ied' ? e.category === 'ied' : (e.category === 'apparatus' || !e.category));
            if (group.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: 'var(--space-3)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {cat === 'apparatus' ? 'Búnaður' : 'IED'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {group.map(eq => {
                    const checked = bay.equipment_ids.includes(eq.id);
                    return (
                      <label key={eq.id} style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '5px 10px',
                        background: checked ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface-alt)',
                        border: `1px solid ${checked ? 'var(--accent)' : 'var(--line)'}`,
                        borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px',
                      }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleEquipment(eq.id)} style={{ cursor: 'pointer' }} />
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{eq.code}</span>
                        <span style={{ color: 'var(--muted)' }}>{cat === 'ied' ? (eq.model ?? eq.ied_name ?? 'IED') : (eq.type ?? '')}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {bayEquipment.length === 0 && (
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: 'var(--space-1)' }}>
              Ekkert tæki valið — veldu tæki til að nota í merki picker
            </div>
          )}
        </div>
      )}

      {allEquipment.length === 0 && (
        <div style={{ marginBottom: 'var(--space-6)', fontSize: '12px', color: 'var(--muted)' }}>
          Engin tæki skráð í verkefni —{' '}
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}`)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', padding: 0 }}
          >
            bæta við tækjum í verkefni
          </button>
        </div>
      )}

      <SignalTable
        signals={bay.signals}
        equipment={allEquipment}
        library={signalLibrary}
        states={signalStates}
        bayDisplayId={bay.display_id}
        // reviewMode added in Task 3
        {...({ reviewMode: isInReview || bay.signals.some(s => s.review_flagged) } as object)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {showPicker && (
        <SignalPickerModal
          phase="DESIGN"
          equipment={bayEquipment}
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
