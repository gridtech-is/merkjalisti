// src/pages/ProjectView.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { loadProject } from '../services/projectService';
import { listBays } from '../services/bayService';
import { Card, Button, Badge } from '../components/ui';
import type { Project, Equipment, EquipmentTemplate, Bay, ApparatusType, EquipmentCategory } from '../types';

type Tab = 'bays' | 'equipment' | 'station' | 'overview';
type EqTab = 'apparatus' | 'ied';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const APPARATUS_TYPES: ApparatusType[] = [
  'Aflrofi', 'Skilrofi', 'Jarðrofi', 'Spennir', 'Stjórnbúnaður', 'Annað',
];

function emptyApparatus(code: string, type: ApparatusType, desc: string): Equipment {
  return { id: uuid(), category: 'apparatus', code, type, ied_name: null, manufacturer: null, model: null, template_id: null, description: desc };
}

function emptyIED(code: string, iedName: string, tmpl: EquipmentTemplate | null, desc: string): Equipment {
  return {
    id: uuid(), category: 'ied', code,
    type: null,
    ied_name: iedName || null,
    manufacturer: tmpl?.manufacturer ?? null,
    model: tmpl?.model ?? null,
    template_id: tmpl?.id ?? null,
    description: desc || tmpl?.description || '',
  };
}

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { api } = useApi();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentSha, setEquipmentSha] = useState('');
  const [templates, setTemplates] = useState<EquipmentTemplate[]>([]);
  const [bays, setBays] = useState<Bay[]>([]);
  const [tab, setTab] = useState<Tab>('bays');
  const [eqTab, setEqTab] = useState<EqTab>('apparatus');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  // Apparatus new row
  const [newACode, setNewACode] = useState('');
  const [newAType, setNewAType] = useState<ApparatusType>('Aflrofi');
  const [newADesc, setNewADesc] = useState('');

  // IED new row
  const [newICode, setNewICode] = useState('');
  const [newIName, setNewIName] = useState('');
  const [newITemplateId, setNewITemplateId] = useState('');
  const [newIDesc, setNewIDesc] = useState('');

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      loadProject(api, projectId),
      listBays(api, projectId),
      api.readJson<EquipmentTemplate[]>('data/equipment_templates.json').catch(() => ({ data: [], sha: '' })),
    ]).then(([files, bayList, { data: tmplData }]) => {
      setProject(files.project);
      setEquipment(files.equipment);
      setEquipmentSha(files.equipmentSha);
      setBays(bayList);
      setTemplates(tmplData);
    }).catch(() => {
      setLoadError('Gat ekki hlaðið verkefni. Það gæti verið ófullkomið eða eytt.');
    }).finally(() => setLoading(false));
  }, [api, projectId]);

  // When IED template changes, auto-fill description
  useEffect(() => {
    const tmpl = templates.find(t => t.id === newITemplateId);
    if (tmpl) setNewIDesc(tmpl.description ?? '');
  }, [newITemplateId, templates]);

  const saveEquipment = async (updated: Equipment[]) => {
    const msg = `[DESIGN] Uppfæra tæki`;
    const newSha = await api.writeJson(`projects/${projectId}/equipment.json`, updated, equipmentSha, msg);
    setEquipment(updated);
    setEquipmentSha(newSha);
  };

  const handleAddApparatus = async () => {
    const code = newACode.trim().toUpperCase();
    if (!code || !projectId) return;
    setSaving(true);
    try {
      await saveEquipment([...equipment, emptyApparatus(code, newAType, newADesc.trim())]);
      setNewACode(''); setNewADesc('');
    } finally { setSaving(false); }
  };

  const handleAddIED = async () => {
    const code = newICode.trim().toUpperCase();
    if (!code || !projectId) return;
    const tmpl = templates.find(t => t.id === newITemplateId) ?? null;
    setSaving(true);
    try {
      await saveEquipment([...equipment, emptyIED(code, newIName.trim(), tmpl, newIDesc.trim())]);
      setNewICode(''); setNewIName(''); setNewITemplateId(''); setNewIDesc('');
    } finally { setSaving(false); }
  };

  const handleDelete = async (eqId: string) => {
    if (!projectId) return;
    setSaving(true);
    try {
      await saveEquipment(equipment.filter(e => e.id !== eqId));
    } finally { setSaving(false); }
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

  const apparatus = equipment.filter(e => e.category === 'apparatus' || !e.category);
  const ieds = equipment.filter(e => e.category === 'ied');

  const TABS: { id: Tab; label: string }[] = [
    { id: 'bays', label: `Reitir (${bays.length})` },
    { id: 'equipment', label: `Tæki (${equipment.length})` },
    { id: 'station', label: 'Stöðvarmerki' },
    { id: 'overview', label: 'Heildar listi' },
  ];

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '5px 8px', fontSize: '12px', outline: 'none',
  };
  const cellStyle: React.CSSProperties = {
    padding: '7px 10px', borderBottom: '1px solid var(--line-muted)', fontSize: '13px',
  };
  const headStyle: React.CSSProperties = {
    padding: '6px 10px', background: 'var(--surface-alt)',
    borderBottom: '1px solid var(--line)', fontWeight: 600,
    color: 'var(--text-secondary)', textAlign: 'left', fontSize: '12px',
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>← Verkefni</Button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>{project.name}</h1>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            {apparatus.length} búnaður · {ieds.length} IED · {bays.length} reitir
          </div>
        </div>
        <Badge phase={project.phase}>{project.phase}</Badge>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--line)', marginBottom: 'var(--space-6)' }}>
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer',
            fontSize: '13px', fontWeight: tab === t.id ? 600 : 400,
            color: tab === t.id ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: '-1px',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Reitir */}
      {tab === 'bays' && (
        <div>
          <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => navigate(`/projects/${projectId}/bays/new`)}>+ Nýr reitur</Button>
          </div>
          {bays.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--muted)' }}>
              Engir reitir enn. Bættu við nýjum reit.
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {bays.map(bay => (
                <Card key={bay.id} padding="var(--space-4) var(--space-5)" style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/projects/${projectId}/bays/${bay.id}`)}>
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
          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-4)' }}>
            {([['apparatus', `Búnaður (${apparatus.length})`], ['ied', `IED (${ieds.length})`]] as [EqTab, string][]).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setEqTab(id)} style={{
                background: eqTab === id ? 'var(--accent)' : 'var(--surface-alt)',
                color: eqTab === id ? 'white' : 'var(--text-secondary)',
                border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
                padding: '5px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
              }}>{label}</button>
            ))}
          </div>

          {/* Búnaður */}
          {eqTab === 'apparatus' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Kóði', 'Gerð', 'Lýsing', ''].map(h => <th key={h} style={headStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {apparatus.map(eq => (
                  <tr key={eq.id}>
                    <td style={{ ...cellStyle, fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>{eq.code}</td>
                    <td style={cellStyle}>{eq.type ?? '—'}</td>
                    <td style={{ ...cellStyle, color: 'var(--muted)', width: '100%' }}>{eq.description || '—'}</td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      <Button variant="danger" size="sm" disabled={saving} onClick={() => handleDelete(eq.id)}>Eyða</Button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: '6px 10px' }}>
                    <input value={newACode} onChange={e => setNewACode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleAddApparatus()}
                      placeholder="QA1" style={{ ...inputStyle, fontFamily: 'monospace', width: '80px' }} />
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <select value={newAType} onChange={e => setNewAType(e.target.value as ApparatusType)}
                      style={{ ...inputStyle, cursor: 'pointer' }}>
                      {APPARATUS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <input value={newADesc} onChange={e => setNewADesc(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddApparatus()}
                      placeholder="Lýsing (valkvæmt)" style={{ ...inputStyle, width: '100%' }} />
                  </td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <Button size="sm" disabled={!newACode.trim() || saving} onClick={handleAddApparatus}>+ Bæta við</Button>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* IED */}
          {eqTab === 'ied' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Tech key', 'IED nafn', 'Sniðmát', 'Framleiðandi', 'Líkan', 'Lýsing', ''].map(h => <th key={h} style={headStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {ieds.map(eq => (
                  <tr key={eq.id}>
                    <td style={{ ...cellStyle, fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>{eq.code}</td>
                    <td style={{ ...cellStyle, fontFamily: 'monospace' }}>{eq.ied_name ?? '—'}</td>
                    <td style={{ ...cellStyle, color: 'var(--muted)', fontSize: '11px' }}>
                      {eq.template_id ? (templates.find(t => t.id === eq.template_id)?.name ?? eq.template_id) : '—'}
                    </td>
                    <td style={cellStyle}>{eq.manufacturer ?? '—'}</td>
                    <td style={cellStyle}>{eq.model ?? '—'}</td>
                    <td style={{ ...cellStyle, color: 'var(--muted)', width: '100%' }}>{eq.description || '—'}</td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      <Button variant="danger" size="sm" disabled={saving} onClick={() => handleDelete(eq.id)}>Eyða</Button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: '6px 10px' }}>
                    <input value={newICode} onChange={e => setNewICode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleAddIED()}
                      placeholder="QD01" style={{ ...inputStyle, fontFamily: 'monospace', width: '75px' }} />
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <input value={newIName} onChange={e => setNewIName(e.target.value)}
                      placeholder="Q0IED" style={{ ...inputStyle, fontFamily: 'monospace', width: '90px' }} />
                  </td>
                  <td style={{ padding: '6px 10px' }} colSpan={3}>
                    <select value={newITemplateId} onChange={e => setNewITemplateId(e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer', width: '100%' }}>
                      <option value="">— Ekkert sniðmát —</option>
                      {templates.filter(t => t.category === 'ied').map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <input value={newIDesc} onChange={e => setNewIDesc(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddIED()}
                      placeholder="Lýsing" style={{ ...inputStyle, width: '100%' }} />
                  </td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    <Button size="sm" disabled={!newICode.trim() || saving} onClick={handleAddIED}>+ Bæta við</Button>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
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
