// src/pages/BayView.tsx
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { loadBay, saveBay, type BayFile } from '../services/bayService';
import { useAutoCommit } from '../github/useAutoCommit';
import { Button } from '../components/ui';
import { SignalTable } from '../components/SignalTable';
import { SignalPickerModal } from '../components/SignalFormModal';
import type { BaySignal, Equipment, EquipmentType } from '../types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const EQUIPMENT_TYPES: EquipmentType[] = [
  'Vörn', 'Aflrofi', 'Skilrofi', 'Jarðrofi', 'Spennir', 'Stjórnbúnaður', 'Annað',
];

export function BayView() {
  const { projectId, bayId } = useParams<{ projectId: string; bayId: string }>();
  const { api } = useApi();
  const navigate = useNavigate();
  const [bayFile, setBayFile] = useState<BayFile | null>(null);
  const [allEquipment, setAllEquipment] = useState<Equipment[]>([]);
  const [equipmentSha, setEquipmentSha] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  // New equipment row state
  const [newEqCode, setNewEqCode] = useState('');
  const [newEqType, setNewEqType] = useState<EquipmentType>('Vörn');
  const [newEqDesc, setNewEqDesc] = useState('');

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

  // Equipment in this bay
  const bayEquipment = bayFile
    ? allEquipment.filter(e => bayFile.bay.equipment_ids.includes(e.id))
    : [];

  const handleAddEquipment = () => {
    const code = newEqCode.trim().toUpperCase();
    if (!code) return;
    const eq: Equipment = { id: uuid(), type: newEqType, code, ied_names: [], description: newEqDesc.trim() };
    setAllEquipment(prev => [...prev, eq]);
    setBayFile(prev => {
      if (!prev) return prev;
      return { ...prev, bay: { ...prev.bay, equipment_ids: [...prev.bay.equipment_ids, eq.id] } };
    });
    setNewEqCode('');
    setNewEqDesc('');
    setNewEqType('Vörn');
    setIsDirty(true);
  };

  const handleRemoveEquipment = (eqId: string) => {
    setBayFile(prev => {
      if (!prev) return prev;
      return { ...prev, bay: { ...prev.bay, equipment_ids: prev.bay.equipment_ids.filter(id => id !== eqId) } };
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
    // Save equipment.json first, then bay (sequential — GitHub API constraint)
    const msg = `[DESIGN] Vista reit: ${current.bay.display_id}`;
    const newEqSha = await api.writeJson(
      `projects/${projectId}/equipment.json`,
      allEquipmentRef.current,
      equipmentShaRef.current,
      msg,
    );
    setEquipmentSha(newEqSha);
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

      {/* Equipment list */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>
          Tæki í reit
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              {['Kóði', 'Gerð', 'Lýsing', ''].map(h => (
                <th key={h} style={{
                  padding: '5px 8px', background: 'var(--surface-alt)',
                  borderBottom: '1px solid var(--line)', fontWeight: 600,
                  color: 'var(--text-secondary)', textAlign: 'left',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bayEquipment.map(eq => (
              <tr key={eq.id}>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--line-muted)', fontFamily: 'monospace', color: 'var(--accent)' }}>
                  {eq.code}
                </td>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--line-muted)' }}>
                  {eq.type}
                </td>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--line-muted)', color: 'var(--muted)', width: '100%' }}>
                  {eq.description || '—'}
                </td>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid var(--line-muted)', whiteSpace: 'nowrap' }}>
                  <Button variant="danger" size="sm" onClick={() => handleRemoveEquipment(eq.id)}>Eyða</Button>
                </td>
              </tr>
            ))}
            {/* Add new row */}
            <tr>
              <td style={{ padding: '4px 8px' }}>
                <input
                  value={newEqCode}
                  onChange={e => setNewEqCode(e.target.value.toUpperCase())}
                  placeholder="QA1"
                  onKeyDown={e => e.key === 'Enter' && handleAddEquipment()}
                  style={{
                    background: 'var(--surface-alt)', border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                    padding: '4px 8px', fontSize: '12px', fontFamily: 'monospace',
                    width: '80px', outline: 'none',
                  }}
                />
              </td>
              <td style={{ padding: '4px 8px' }}>
                <select
                  value={newEqType}
                  onChange={e => setNewEqType(e.target.value as EquipmentType)}
                  style={{
                    background: 'var(--surface-alt)', border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                    padding: '4px 6px', fontSize: '12px', outline: 'none', cursor: 'pointer',
                  }}
                >
                  {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td style={{ padding: '4px 8px' }}>
                <input
                  value={newEqDesc}
                  onChange={e => setNewEqDesc(e.target.value)}
                  placeholder="Lýsing (valkvæmt)"
                  onKeyDown={e => e.key === 'Enter' && handleAddEquipment()}
                  style={{
                    background: 'var(--surface-alt)', border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                    padding: '4px 8px', fontSize: '12px', width: '100%', outline: 'none',
                  }}
                />
              </td>
              <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                <Button size="sm" onClick={handleAddEquipment} disabled={!newEqCode.trim()}>
                  + Bæta við
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

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
