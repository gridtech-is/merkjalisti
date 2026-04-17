// src/pages/ProjectView.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { loadProject, saveProjectPhase } from '../services/projectService';
import { exportAllBaysToExcel } from '../services/exportService';
import { ChangelogTab } from '../components/ChangelogTab';
import { listBays, loadBay, sendBayForReview } from '../services/bayService';
import { Card, Button, Badge } from '../components/ui';
import { ImportScdModal } from '../components/ImportScdModal';
import type { Project, Equipment, EquipmentTemplate, Bay, ApparatusType, ProjectPhase, BayStatus } from '../types';
import { StationSignalsTab } from '../components/StationSignalsTab';
import { OverviewTab } from '../components/OverviewTab';
import { loadStation } from '../services/stationService';

type Tab = 'bays' | 'equipment' | 'station' | 'overview' | 'changelog';
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

const PHASE_ORDER: ProjectPhase[] = ['DESIGN', 'FROZEN', 'REVIEW', 'FAT', 'SAT'];
const PHASE_LABELS: Record<ProjectPhase, string> = {
  DESIGN: 'Hönnun', FROZEN: 'Læst', REVIEW: 'Yfirferð', FAT: 'FAT', SAT: 'SAT',
};
const PHASE_COLORS: Record<ProjectPhase, string> = {
  DESIGN: 'var(--accent)', FROZEN: 'var(--text-secondary)',
  REVIEW: 'var(--warn)', FAT: '#8b5cf6', SAT: 'var(--success)',
};

function PhaseBar({ phase, onAdvance, onRegress, disabled }: { phase: ProjectPhase; onAdvance: () => void; onRegress: () => void; disabled?: boolean }) {
  const idx = PHASE_ORDER.indexOf(phase);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
      {PHASE_ORDER.map((p, i) => (
        <React.Fragment key={p}>
          <div style={{
            padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: i === idx ? 700 : 400,
            background: i === idx ? PHASE_COLORS[p] : 'var(--surface-alt)',
            color: i === idx ? '#fff' : i < idx ? PHASE_COLORS[p] : 'var(--muted)',
            border: `1px solid ${i <= idx ? PHASE_COLORS[p] : 'var(--line)'}`,
          }}>
            {i < idx ? '✓ ' : ''}{PHASE_LABELS[p]}
          </div>
          {i < PHASE_ORDER.length - 1 && (
            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>→</span>
          )}
        </React.Fragment>
      ))}
      {idx > 0 && (
        <Button size="sm" variant="ghost" onClick={onRegress} disabled={disabled} style={{ marginLeft: 'var(--space-2)' }}>
          ← Til baka í {PHASE_LABELS[PHASE_ORDER[idx - 1]]}
        </Button>
      )}
      {idx < PHASE_ORDER.length - 1 && (
        <Button size="sm" onClick={onAdvance} disabled={disabled}>
          Fara í {PHASE_LABELS[PHASE_ORDER[idx + 1]]} →
        </Button>
      )}
    </div>
  );
}

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
  const { api, userName } = useApi();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentSha, setEquipmentSha] = useState('');
  const [templates, setTemplates] = useState<EquipmentTemplate[]>([]);
  const [bays, setBays] = useState<Bay[]>([]);
  const [tab, setTab] = useState<Tab>('bays');
  const [eqTab, setEqTab] = useState<EqTab>('apparatus');
  const [showScd, setShowScd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [projectSha, setProjectSha] = useState('');
  const [sendingReview, setSendingReview] = useState(false);
  const [stationStatus, setStationStatus] = useState<BayStatus | null>(null);

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
      loadStation(api, projectId).catch(() => null),
    ]).then(([files, bayList, { data: tmplData }, stationFile]) => {
      setProject(files.project);
      setProjectSha(files.projectSha);
      setEquipment(files.equipment);
      setEquipmentSha(files.equipmentSha);
      setBays(bayList);
      setTemplates(tmplData);
      setStationStatus(stationFile?.station.status ?? null);
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

  const handleUpdate = async (eqId: string, patch: Partial<Equipment>) => {
    if (!projectId) return;
    const updated = equipment.map(e => e.id === eqId ? { ...e, ...patch } : e);
    setSaving(true);
    try {
      await saveEquipment(updated);
    } finally { setSaving(false); }
  };

  const handleDelete = async (eqId: string) => {
    if (!projectId) return;
    setSaving(true);
    try {
      await saveEquipment(equipment.filter(e => e.id !== eqId));
    } finally { setSaving(false); }
  };

  const handleSendBayForReview = async (bayId: string) => {
    if (!projectId) return;
    setSendingReview(true);
    try {
      const bayFile = await loadBay(api, projectId, bayId);
      await sendBayForReview(api, projectId, bayFile, userName);
      const updated = await listBays(api, projectId);
      setBays(updated);
    } catch {
      alert('Villa við að senda reit í yfirferð.');
    } finally {
      setSendingReview(false);
    }
  };

  const handleSendAllForReview = async () => {
    const draftBays = bays.filter(b => b.status === 'DRAFT');
    if (draftBays.length === 0) return;
    if (!confirm(`Senda ${draftBays.length} reiti í yfirferð?`)) return;
    if (!projectId) return;
    setSendingReview(true);
    try {
      for (const bay of draftBays) {
        const bayFile = await loadBay(api, projectId, bay.id);
        await sendBayForReview(api, projectId, bayFile, userName);
      }
    } catch {
      alert('Villa við að senda reiti í yfirferð.');
    } finally {
      setSendingReview(false);
      listBays(api, projectId).then(setBays).catch(() => {});
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

  const apparatus = equipment.filter(e => e.category === 'apparatus' || !e.category);
  const ieds = equipment.filter(e => e.category === 'ied');

  const stationIndicator = stationStatus === 'IN_REVIEW' ? ' •' : stationStatus === 'LOCKED' ? ' ✓' : '';
  const TABS: { id: Tab; label: string }[] = [
    { id: 'bays', label: `Reitir (${bays.length})` },
    { id: 'equipment', label: `Tæki (${equipment.length})` },
    { id: 'station', label: `Stöðvarmerki${stationIndicator}` },
    { id: 'overview', label: 'Heildar listi' },
    { id: 'changelog', label: 'Breytingasaga' },
  ];

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '5px 8px', fontSize: '12px', outline: 'none',
  };
  const editInput: React.CSSProperties = {
    background: 'transparent', border: '1px solid transparent',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '3px 6px', fontSize: '12px', fontFamily: 'inherit',
    width: '100%', outline: 'none',
  };
  const editSelect: React.CSSProperties = {
    background: 'var(--surface-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '3px 6px', fontSize: '12px', outline: 'none', cursor: 'pointer', width: '100%',
  };
  const cellStyle: React.CSSProperties = {
    padding: '4px 8px', borderBottom: '1px solid var(--line-muted)', fontSize: '13px',
  };
  const headStyle: React.CSSProperties = {
    padding: '6px 10px', background: 'var(--surface-alt)',
    borderBottom: '1px solid var(--line)', fontWeight: 600,
    color: 'var(--text-secondary)', textAlign: 'left', fontSize: '12px',
  };
  const focusInput = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = 'var(--accent)');
  const blurInput = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = 'transparent');

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

      <PhaseBar
        phase={project.phase}
        disabled={saving}
        onAdvance={async () => {
          if (saving) return;
          const idx = PHASE_ORDER.indexOf(project.phase);
          if (idx >= PHASE_ORDER.length - 1) return;
          const next = PHASE_ORDER[idx + 1];
          if (!confirm(`Fara úr ${project.phase} í ${next}?`)) return;
          setSaving(true);
          try {
            const { project: updated, sha } = await saveProjectPhase(api, projectId!, project, projectSha, next);
            setProject(updated);
            setProjectSha(sha);
          } catch {
            alert('Villa við að vista fasa. Reyndu aftur.');
          } finally {
            setSaving(false);
          }
        }}
        onRegress={async () => {
          if (saving) return;
          const idx = PHASE_ORDER.indexOf(project.phase);
          if (idx <= 0) return;
          const prev = PHASE_ORDER[idx - 1];
          if (!confirm(`Fara úr ${project.phase} til baka í ${prev}?`)) return;
          setSaving(true);
          try {
            const { project: updated, sha } = await saveProjectPhase(api, projectId!, project, projectSha, prev);
            setProject(updated);
            setProjectSha(sha);
          } catch {
            alert('Villa við að vista fasa. Reyndu aftur.');
          } finally {
            setSaving(false);
          }
        }}
      />

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
          <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            {bays.length > 0 && bays.every(b => b.status === 'LOCKED') && (
              <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>✓ Allt læst</span>
            )}
            {bays.some(b => b.status === 'DRAFT') && (
              <Button variant="ghost" size="sm" onClick={handleSendAllForReview} disabled={sendingReview}>→ Senda alla í yfirferð</Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => exportAllBaysToExcel(bays, project?.name ?? 'verkefni')}>↓ Excel (allt)</Button>
            <Button onClick={() => navigate(`/projects/${projectId}/bays/new`)}>+ Nýr reitur</Button>
          </div>
          {bays.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--muted)' }}>
              Engir reitir enn. Bættu við nýjum reit.
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {bays.map(bay => {
                const statusColor = bay.status === 'LOCKED' ? 'var(--success)' : bay.status === 'IN_REVIEW' ? 'var(--accent)' : 'var(--warn)';
                const statusLabel = bay.status === 'LOCKED' ? 'LÆST' : bay.status === 'IN_REVIEW' ? 'Í YFIRFERÐ' : 'DRAFT';
                return (
                  <Card key={bay.id} padding="var(--space-4) var(--space-5)" style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/projects/${projectId}/bays/${bay.id}`)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{bay.display_id}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {bay.signals.length} merki · {bay.equipment_ids.length} tæki
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 7px',
                          borderRadius: 'var(--radius-sm)',
                          background: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
                          color: statusColor,
                          border: `1px solid ${statusColor}`,
                        }}>{statusLabel}</span>
                        {bay.status === 'DRAFT' && (
                          <Button size="sm" variant="ghost" disabled={sendingReview}
                            onClick={e => { e.stopPropagation(); handleSendBayForReview(bay.id); }}>
                            → Yfirferð
                          </Button>
                        )}
                        <span style={{ color: 'var(--muted)', fontSize: '18px' }}>›</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
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
                    <td style={{ ...cellStyle, minWidth: '80px' }}>
                      <input style={{ ...editInput, fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}
                        defaultValue={eq.code} key={`ac-${eq.id}`}
                        onFocus={focusInput} onBlur={e => { blurInput(e); const v = e.target.value.trim().toUpperCase(); if (v && v !== eq.code) handleUpdate(eq.id, { code: v }); }}
                        onChange={() => {}} />
                    </td>
                    <td style={{ ...cellStyle, minWidth: '130px' }}>
                      <select style={editSelect} value={eq.type ?? 'Annað'}
                        onChange={e => handleUpdate(eq.id, { type: e.target.value as ApparatusType })}>
                        {APPARATUS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td style={{ ...cellStyle, width: '100%' }}>
                      <input style={editInput} defaultValue={eq.description} key={`ad-${eq.id}`}
                        placeholder="Lýsing" onFocus={focusInput}
                        onBlur={e => { blurInput(e); handleUpdate(eq.id, { description: e.target.value }); }}
                        onChange={() => {}} />
                    </td>
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
            <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-3)' }}>
              <Button variant="ghost" size="sm" onClick={() => setShowScd(true)}>↑ Innflytja SCD skrá</Button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Tech key', 'IED nafn', 'Sniðmát', 'Framleiðandi', 'Líkan', 'Lýsing', ''].map(h => <th key={h} style={headStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {ieds.map(eq => (
                  <tr key={eq.id}>
                    <td style={{ ...cellStyle, minWidth: '80px' }}>
                      <input style={{ ...editInput, fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}
                        defaultValue={eq.code} key={`ic-${eq.id}`}
                        onFocus={focusInput} onBlur={e => { blurInput(e); const v = e.target.value.trim().toUpperCase(); if (v && v !== eq.code) handleUpdate(eq.id, { code: v }); }}
                        onChange={() => {}} />
                    </td>
                    <td style={{ ...cellStyle, minWidth: '90px' }}>
                      <input style={{ ...editInput, fontFamily: 'monospace' }}
                        defaultValue={eq.ied_name ?? ''} key={`in-${eq.id}`} placeholder="Q0IED"
                        onFocus={focusInput} onBlur={e => { blurInput(e); handleUpdate(eq.id, { ied_name: e.target.value || null }); }}
                        onChange={() => {}} />
                    </td>
                    <td style={{ ...cellStyle, minWidth: '160px' }}>
                      <select style={editSelect} value={eq.template_id ?? ''}
                        onChange={e => {
                          const tmpl = templates.find(t => t.id === e.target.value) ?? null;
                          handleUpdate(eq.id, {
                            template_id: tmpl?.id ?? null,
                            manufacturer: tmpl?.manufacturer ?? eq.manufacturer,
                            model: tmpl?.model ?? eq.model,
                            description: tmpl?.description ?? eq.description,
                          });
                        }}>
                        <option value="">— Ekkert sniðmát —</option>
                        {templates.filter(t => t.category === 'ied').map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...cellStyle, minWidth: '90px' }}>
                      <input style={editInput} defaultValue={eq.manufacturer ?? ''} key={`im-${eq.id}`}
                        placeholder="ABB" onFocus={focusInput}
                        onBlur={e => { blurInput(e); handleUpdate(eq.id, { manufacturer: e.target.value || null }); }}
                        onChange={() => {}} />
                    </td>
                    <td style={{ ...cellStyle, minWidth: '80px' }}>
                      <input style={editInput} defaultValue={eq.model ?? ''} key={`imd-${eq.id}`}
                        placeholder="REL670" onFocus={focusInput}
                        onBlur={e => { blurInput(e); handleUpdate(eq.id, { model: e.target.value || null }); }}
                        onChange={() => {}} />
                    </td>
                    <td style={{ ...cellStyle, width: '100%' }}>
                      <input style={editInput} defaultValue={eq.description} key={`id-${eq.id}`}
                        placeholder="Lýsing" onFocus={focusInput}
                        onBlur={e => { blurInput(e); handleUpdate(eq.id, { description: e.target.value }); }}
                        onChange={() => {}} />
                    </td>
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
            </>
          )}
        </div>
      )}

      {showScd && (
        <ImportScdModal
          onAddEquipment={async (items) => {
            setSaving(true);
            try {
              await saveEquipment([...equipment, ...items]);
              setShowScd(false);
              setEqTab('ied');
            } finally { setSaving(false); }
          }}
          onClose={() => setShowScd(false)}
        />
      )}

      {tab === 'station' && projectId && project && (
        <StationSignalsTab
          projectId={projectId}
          projectPhase={project.phase}
          equipment={equipment}
        />
      )}
      {tab === 'overview' && projectId && project && (
        <OverviewTab projectId={projectId} projectName={project.name} />
      )}
      {tab === 'changelog' && projectId && <ChangelogTab projectId={projectId} />}
    </div>
  );
}
