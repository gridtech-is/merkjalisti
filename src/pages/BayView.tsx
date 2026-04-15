// src/pages/BayView.tsx
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { loadBay, saveBay, type BayFile } from '../services/bayService';
import { useAutoCommit } from '../github/useAutoCommit';
import { Button } from '../components/ui';
import { SignalTable } from '../components/SignalTable';
import { SignalFormModal } from '../components/SignalFormModal';
import type { BaySignal } from '../types';

export function BayView() {
  const { projectId, bayId } = useParams<{ projectId: string; bayId: string }>();
  const { api } = useApi();
  const navigate = useNavigate();
  const [bayFile, setBayFile] = useState<BayFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [modalSignal, setModalSignal] = useState<BaySignal | null | undefined>(undefined);
  // undefined = modal closed, null = add mode, BaySignal = edit mode
  const bayFileRef = useRef<BayFile | null>(null);
  bayFileRef.current = bayFile;

  useEffect(() => {
    if (!projectId || !bayId) return;
    loadBay(api, projectId, bayId)
      .then(f => setBayFile(f))
      .finally(() => setLoading(false));
  }, [api, projectId, bayId]);

  const handleAdd = (signal: BaySignal) => {
    setBayFile(prev => {
      if (!prev) return prev;
      return { ...prev, bay: { ...prev.bay, signals: [...prev.bay.signals, signal] } };
    });
    setIsDirty(true);
    setModalSignal(undefined);
  };

  const handleEditSave = (signal: BaySignal) => {
    setBayFile(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        bay: { ...prev.bay, signals: prev.bay.signals.map(s => s.id === signal.id ? signal : s) },
      };
    });
    setIsDirty(true);
    setModalSignal(undefined);
  };

  const handleDelete = (signalId: string) => {
    setBayFile(prev => {
      if (!prev) return prev;
      return { ...prev, bay: { ...prev.bay, signals: prev.bay.signals.filter(s => s.id !== signalId) } };
    });
    setIsDirty(true);
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
    const updated = await saveBay(api, projectId, current, 'DESIGN');
    setBayFile(updated);
    setIsDirty(false);
    setLastSaved(new Date());
  };

  useAutoCommit(isDirty, commitChanges);

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;
  if (!bayFile) return <p style={{ color: 'var(--danger)' }}>Reitur finnst ekki.</p>;

  const { bay } = bayFile;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {isDirty && (
            <span style={{ fontSize: '12px', color: 'var(--warn)' }}>● Óvistað</span>
          )}
          {lastSaved && !isDirty && (
            <span style={{ fontSize: '12px', color: 'var(--success)' }}>
              ✓ Vistað {lastSaved.toLocaleTimeString('is-IS')}
            </span>
          )}
          <Button size="sm" onClick={() => setModalSignal(null)}>+ Bæta við merki</Button>
          <Button
            size="sm"
            onClick={commitChanges}
            disabled={!isDirty}
          >
            Vista núna
          </Button>
        </div>
      </div>

      <SignalTable
        signals={bay.signals}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onEdit={sig => setModalSignal(sig)}
      />

      {modalSignal !== undefined && (
        <SignalFormModal
          initial={modalSignal}
          phase="DESIGN"
          onSave={modalSignal === null ? handleAdd : handleEditSave}
          onClose={() => setModalSignal(undefined)}
        />
      )}
    </div>
  );
}
