// src/pages/BayView.tsx
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { loadBay, saveBay, type BayFile } from '../services/bayService';
import { useAutoCommit } from '../github/useAutoCommit';
import { Button } from '../components/ui';
import { SignalTable } from '../components/SignalTable';
import { SignalPickerModal } from '../components/SignalFormModal';
import type { BaySignal, Equipment } from '../types';

export function BayView() {
  const { projectId, bayId } = useParams<{ projectId: string; bayId: string }>();
  const { api } = useApi();
  const navigate = useNavigate();
  const [bayFile, setBayFile] = useState<BayFile | null>(null);
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [equipmentSha, setEquipmentSha] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

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
    ]).then(([f, { data: eq, sha: eqSha }]) => {
      setBayFile(f);
      setAllEquipment(eq);
      setEquipmentSha(eqSha);
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
          <Button size="sm" onClick={() => setShowPicker(true)}>+ Bæta við merki</Button>
          <Button size="sm" onClick={commitChanges} disabled={!isDirty}>Vista núna</Button>
        </div>
      </div>

      {/* Equipment assignment */}
      {allEquipment.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>
            Tæki í reit
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {allEquipment.map(eq => {
              const checked = bay.equipment_ids.includes(eq.id);
              return (
                <label
                  key={eq.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '5px 10px',
                    background: checked ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface-alt)',
                    border: `1px solid ${checked ? 'var(--accent)' : 'var(--line)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', fontSize: '12px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEquipment(eq.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{eq.code}</span>
                  <span style={{ color: 'var(--muted)' }}>{eq.type}</span>
                </label>
              );
            })}
          </div>
          {allEquipment.length > 0 && bayEquipment.length === 0 && (
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: 'var(--space-2)' }}>
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
    </div>
  );
}
