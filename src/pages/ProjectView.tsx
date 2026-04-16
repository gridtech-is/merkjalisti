// src/pages/ProjectView.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { loadProject } from '../services/projectService';
import { listBays } from '../services/bayService';
import { Card, Button, Badge } from '../components/ui';
import type { Project, Equipment, Bay, EquipmentType } from '../types';

type Tab = 'bays' | 'equipment' | 'station' | 'overview';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const EQUIPMENT_TYPES: EquipmentType[] = [
  'Vörn', 'Aflrofi', 'Skilrofi', 'Jarðrofi', 'Spennir', 'Stjórnbúnaður', 'Annað',
];

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { api } = useApi();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentSha, setEquipmentSha] = useState('');
  const [bays, setBays] = useState<Bay[]>([]);
  const [tab, setTab] = useState<Tab>('bays');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  // New equipment row
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState<EquipmentType>('Vörn');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      loadProject(api, projectId),
      listBays(api, projectId),
    ]).then(([files, bayList]) => {
      setProject(files.project);
      setEquipment(files.equipment);
      setEquipmentSha(files.equipmentSha);
      setBays(bayList);
    }).catch(() => {
      setLoadError('Gat ekki hlaðið verkefni. Það gæti verið ófullkomið eða eytt.');
    }).finally(() => setLoading(false));
  }, [api, projectId]);

  const handleAddEquipment = async () => {
    const code = newCode.trim().toUpperCase();
    if (!code || !projectId) return;
    const eq: Equipment = { id: uuid(), type: newType, code, ied_names: [], description: newDesc.trim() };
    const updated = [...equipment, eq];
    setSaving(true);
    try {
      const msg = `[DESIGN] Bæta við tæki: ${code}`;
      const newSha = await api.writeJson(`projects/${projectId}/equipment.json`, updated, equipmentSha, msg);
      setEquipment(updated);
      setEquipmentSha(newSha);
      setNewCode('');
      setNewDesc('');
      setNewType('Vörn');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEquipment = async (eqId: string) => {
    if (!projectId) return;
    const updated = equipment.filter(e => e.id !== eqId);
    setSaving(true);
    try {
      const msg = `[DESIGN] Eyða tæki`;
      const newSha = await api.writeJson(`projects/${projectId}/equipment.json`, updated, equipmentSha, msg);
      setEquipment(updated);
      setEquipmentSha(newSha);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;
  if (loadError || !project) return (
    <div>
      <p style={{ color: 'var(--danger)', marginBottom: 'var(--space-4)' }}>
        {loadError || 'Verkefni finnst ekki.'}
      </p>
      <Button variant="ghost" onClick={() => navigate('/')}>← Til baka</Button>
    </div>
  );

  const TABS: { id: Tab; label: string }[] = [
    { id: 'bays', label: `Reitir (${bays.length})` },
    { id: 'equipment', label: `Tæki (${equipment.length})` },
    { id: 'station', label: 'Stöðvarmerki' },
    { id: 'overview', label: 'Heildar listi' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          ← Verkefni
        </Button>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--space-6)',
      }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>{project.name}</h1>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            {equipment.length} tæki · {bays.length} reitir
          </div>
        </div>
        <Badge phase={project.phase}>{project.phase}</Badge>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 'var(--space-1)',
        borderBottom: '1px solid var(--line)', marginBottom: 'var(--space-6)',
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none',
              padding: '8px 16px', cursor: 'pointer',
              fontSize: '13px', fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Reitir */}
      {tab === 'bays' && (
        <div>
          <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => navigate(`/projects/${projectId}/bays/new`)}>
              + Nýr reitur
            </Button>
          </div>
          {bays.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--muted)' }}>
              Engir reitir enn. Bættu við nýjum reit.
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {bays.map(bay => (
                <Card
                  key={bay.id}
                  padding="var(--space-4) var(--space-5)"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/projects/${projectId}/bays/${bay.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{bay.display_id}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {bay.signals.length} merki · {bay.equipment_ids.length} tæki
                      </div>
                    </div>
                    <span style={{ color: 'var(--muted)', fontSize: '18px' }}>›</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tæki */}
      {tab === 'equipment' && (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                {['Kóði', 'Gerð', 'Lýsing', ''].map(h => (
                  <th key={h} style={{
                    padding: '7px 10px', background: 'var(--surface-alt)',
                    borderBottom: '1px solid var(--line)', fontWeight: 600,
                    color: 'var(--text-secondary)', textAlign: 'left',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipment.map(eq => (
                <tr key={eq.id}>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--line-muted)', fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>
                    {eq.code}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--line-muted)' }}>
                    {eq.type}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--line-muted)', color: 'var(--muted)', width: '100%' }}>
                    {eq.description || '—'}
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--line-muted)', whiteSpace: 'nowrap' }}>
                    <Button variant="danger" size="sm" disabled={saving} onClick={() => handleDeleteEquipment(eq.id)}>
                      Eyða
                    </Button>
                  </td>
                </tr>
              ))}
              {/* Add row */}
              <tr>
                <td style={{ padding: '6px 10px' }}>
                  <input
                    value={newCode}
                    onChange={e => setNewCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleAddEquipment()}
                    placeholder="QA1"
                    style={{
                      background: 'var(--surface-alt)', border: '1px solid var(--line)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                      padding: '5px 8px', fontSize: '12px', fontFamily: 'monospace',
                      width: '90px', outline: 'none',
                    }}
                  />
                </td>
                <td style={{ padding: '6px 10px' }}>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as EquipmentType)}
                    style={{
                      background: 'var(--surface-alt)', border: '1px solid var(--line)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                      padding: '5px 8px', fontSize: '12px', outline: 'none', cursor: 'pointer',
                    }}
                  >
                    {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td style={{ padding: '6px 10px' }}>
                  <input
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddEquipment()}
                    placeholder="Lýsing (valkvæmt)"
                    style={{
                      background: 'var(--surface-alt)', border: '1px solid var(--line)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                      padding: '5px 8px', fontSize: '12px', width: '100%', outline: 'none',
                    }}
                  />
                </td>
                <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                  <Button size="sm" disabled={!newCode.trim() || saving} onClick={handleAddEquipment}>
                    + Bæta við
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'station' && (
        <Card style={{ color: 'var(--muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
          Stöðvarmerki — kemur í Plan 3
        </Card>
      )}

      {tab === 'overview' && (
        <Card style={{ color: 'var(--muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
          Heildar listi — kemur í Plan 3
        </Card>
      )}
    </div>
  );
}
