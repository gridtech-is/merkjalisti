// src/components/StationSignalsTab.tsx
import { useEffect, useRef, useState } from 'react';
import { useApi } from '../context/ApiContext';
import {
  loadStation, saveStation, sendStationForReview, approveStation, rejectStation,
  type StationFile,
} from '../services/stationService';
import { useAutoCommit } from '../github/useAutoCommit';
import { Button } from './ui';
import { SignalTable } from './SignalTable';
import { SignalPickerModal } from './SignalFormModal';
import { appendChange } from '../services/changelogService';
import type { BaySignal, Equipment, SignalLibraryEntry, SignalState, ProjectPhase, StationSignals } from '../types';

interface Props {
  projectId: string;
  projectPhase: ProjectPhase;
  equipment: Equipment[];
}

export function StationSignalsTab({ projectId, projectPhase, equipment }: Props) {
  const { api, userName } = useApi();
  const [file, setFile] = useState<StationFile | null>(null);
  const [library, setLibrary] = useState<SignalLibraryEntry[]>([]);
  const [states, setStates] = useState<SignalState[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [reviewSending, setReviewSending] = useState(false);

  const fileRef = useRef<StationFile | null>(null);
  fileRef.current = file;

  const projectPhaseRef = useRef(projectPhase);
  projectPhaseRef.current = projectPhase;

  useEffect(() => {
    Promise.all([
      loadStation(api, projectId),
      api.readJson<SignalLibraryEntry[]>('data/signal_library.json'),
      api.readJson<SignalState[]>('data/signal_states.json'),
    ]).then(([f, { data: lib }, { data: st }]) => {
      setFile(f);
      setLibrary(lib);
      setStates(st);
    }).finally(() => setLoading(false));
  }, [api, projectId]);

  const handleAdd = (signals: BaySignal[]) => {
    setFile(prev => {
      if (!prev) return prev;
      const next: StationSignals = { ...prev.station, signals: [...prev.station.signals, ...signals] };
      return { ...prev, station: next };
    });
    setIsDirty(true);
    setShowPicker(false);
    signals.forEach(sig => {
      appendChange(api, projectId, {
        user: userName, phase: 'DESIGN', type: 'SIGNAL_ADDED',
        target_id: sig.id, target_type: 'signal',
        field: null, old_value: null, new_value: `${sig.equipment_code}_${sig.signal_name}`,
        comment: `Stöðvarmerki bætt við: ${sig.signal_name}`,
      });
    });
  };

  const handleDelete = (signalId: string) => {
    const sig = fileRef.current?.station.signals.find(s => s.id === signalId);
    setFile(prev => {
      if (!prev) return prev;
      const next: StationSignals = { ...prev.station, signals: prev.station.signals.filter(s => s.id !== signalId) };
      return { ...prev, station: next };
    });
    setIsDirty(true);
    if (sig) {
      appendChange(api, projectId, {
        user: userName, phase: 'DESIGN', type: 'SIGNAL_REMOVED',
        target_id: signalId, target_type: 'signal',
        field: null, old_value: `${sig.equipment_code}_${sig.signal_name}`, new_value: null,
        comment: `Stöðvarmerki eytt: ${sig.signal_name}`,
      });
    }
  };

  const handleUpdate = (signalId: string, patch: Partial<BaySignal>) => {
    setFile(prev => {
      if (!prev) return prev;
      const next: StationSignals = {
        ...prev.station,
        signals: prev.station.signals.map(s => s.id === signalId ? { ...s, ...patch } : s),
      };
      return { ...prev, station: next };
    });
    setIsDirty(true);
  };

  const commitChanges = async () => {
    const current = fileRef.current;
    if (!current) return;

    let toSave = current;
    if (current.station.status === 'LOCKED') {
      const cleared: StationSignals = {
        ...current.station,
        status: 'DRAFT',
        signals: current.station.signals.map(s => ({ ...s, review_flagged: false, review_comment: null })),
      };
      toSave = { ...current, station: cleared };
    }

    const updated = await saveStation(api, projectId, toSave, projectPhaseRef.current);
    setFile(updated);
    setIsDirty(false);
    setLastSaved(new Date());

    if (current.station.status === 'LOCKED') {
      await appendChange(api, projectId, {
        user: userName, phase: 'DESIGN', type: 'PHASE_CHANGED',
        target_id: projectId, target_type: 'station',
        field: null, old_value: 'LOCKED', new_value: 'DRAFT',
        comment: 'Stöðvarmerki opnuð aftur eftir læsingu',
      });
    }
  };

  useAutoCommit(isDirty, commitChanges);

  const handleSendForReview = async () => {
    const current = fileRef.current;
    if (!current) return;
    if (!confirm('Senda stöðvarmerki í yfirferð? Þau verða læst þar til yfirferð lýkur.')) return;
    setReviewSending(true);
    try {
      const updated = await sendStationForReview(api, projectId, current, userName);
      setFile(updated);
      setIsDirty(false);
    } catch {
      alert('Villa við að senda í yfirferð. Reyndu aftur.');
    } finally {
      setReviewSending(false);
    }
  };

  const handleApprove = async () => {
    const current = fileRef.current;
    if (!current) return;
    const raw = prompt('Athugasemd (valkvæmt):');
    if (raw === null) return;
    setReviewSending(true);
    try {
      const comment = raw.trim() || null;
      const updated = await approveStation(api, projectId, current, userName, comment);
      setFile(updated);
    } catch {
      alert('Villa við samþykki. Reyndu aftur.');
    } finally {
      setReviewSending(false);
    }
  };

  const handleReject = async () => {
    const current = fileRef.current;
    if (!current) return;
    const comment = prompt('Ástæða hafnunar (nauðsynlegt):');
    if (!comment?.trim()) return;
    setReviewSending(true);
    try {
      const updated = await rejectStation(api, projectId, current, userName, comment.trim());
      setFile(updated);
    } catch {
      alert('Villa við höfnun. Reyndu aftur.');
    } finally {
      setReviewSending(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;
  if (!file) return <p style={{ color: 'var(--danger)' }}>Stöðvarmerki finnast ekki.</p>;

  const { station } = file;
  const isInReview = station.status === 'IN_REVIEW';
  const isLocked = station.status === 'LOCKED';
  const isDraftStatus = station.status === 'DRAFT';

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)',
      }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {station.signals.length} stöðvarmerki
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!isDraftStatus && (
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              background: isInReview ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'color-mix(in srgb, var(--success) 20%, transparent)',
              color: isInReview ? 'var(--accent)' : 'var(--success)',
              border: `1px solid ${isInReview ? 'var(--accent)' : 'var(--success)'}`,
            }}>
              {isInReview
                ? `Í YFIRFERÐ — sent af ${station.review?.sent_by ?? ''} ${station.review?.sent_at ? new Date(station.review.sent_at).toLocaleDateString('is-IS') : ''}`
                : `LÆST — samþykkt af ${station.review?.reviewed_by ?? ''} ${station.review?.reviewed_at ? new Date(station.review.reviewed_at).toLocaleDateString('is-IS') : ''}`
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
              <Button size="sm" onClick={() => setShowPicker(true)} disabled={projectPhase !== 'DESIGN'}>+ Bæta við merki</Button>
              <Button size="sm" onClick={commitChanges} disabled={!isDirty}>Vista núna</Button>
              <Button size="sm" variant="ghost" onClick={handleSendForReview} disabled={reviewSending || station.signals.length === 0}>→ Senda í yfirferð</Button>
            </>
          )}

          {isInReview && (
            <>
              <Button size="sm" variant="ghost" onClick={handleReject} disabled={reviewSending} style={{ color: 'var(--danger)' }}>✕ Hafna</Button>
              <Button size="sm" onClick={handleApprove} disabled={reviewSending}>✓ Samþykkja</Button>
            </>
          )}

          {isLocked && (
            <>
              <Button size="sm" onClick={() => setShowPicker(true)} disabled={projectPhase !== 'DESIGN'}>+ Bæta við merki</Button>
              <Button size="sm" onClick={commitChanges} disabled={!isDirty}>Vista núna</Button>
            </>
          )}
        </div>
      </div>

      <SignalTable
        signals={station.signals}
        equipment={equipment}
        library={library}
        states={states}
        bayDisplayId="STÖÐ"
        reviewMode={isInReview || station.signals.some(s => s.review_flagged)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {showPicker && (
        <SignalPickerModal
          phase="DESIGN"
          equipment={equipment}
          onAdd={handleAdd}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
