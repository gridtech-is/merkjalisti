// src/pages/ProjectView.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { useProjectNav } from '../context/ProjectNavContext';
import { loadProject, saveProjectPhase } from '../services/projectService';
import { exportAllBaysToExcel, exportEquipmentTemplate, importEquipmentFromExcel } from '../services/exportService';
import { ChangelogTab } from '../components/ChangelogTab';
import { listBays, loadBay, renameStation, sendBayForReview, deleteBay } from '../services/bayService';
import { Card, Button, Badge } from '../components/ui';
import { ImportScdModal } from '../components/ImportScdModal';
import type { Project, Equipment, EquipmentTemplate, Bay, BaySignal, ApparatusType, ProjectPhase, BayStatus, IedFcda } from '../types';
import { StationSignalsTab } from '../components/StationSignalsTab';
import { OverviewTab } from '../components/OverviewTab';
import { loadStation } from '../services/stationService';
import { parseModel, saveModel, loadIedModel } from '../services/iedModelService';
import { createTemplateFromIED } from '../services/equipmentTemplateService';
import { insertDataSetsIntoIcd } from '../services/datasetService';

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

const PHASE_ORDER: ProjectPhase[] = ['DESIGN', 'REVIEW', 'FROZEN', 'FAT', 'SAT'];
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
  return { id: uuid(), category: 'apparatus', code, type, ied_name: null, manufacturer: null, model: null, config_version: null, template_id: null, description: desc };
}

function emptyIED(code: string, iedName: string, tmpl: EquipmentTemplate | null, desc: string): Equipment {
  return {
    id: uuid(), category: 'ied', code,
    type: null,
    ied_name: iedName || null,
    manufacturer: tmpl?.manufacturer ?? null,
    model: tmpl?.model ?? null,
    config_version: null,
    template_id: tmpl?.id ?? null,
    description: desc || tmpl?.description || '',
  };
}

function DataSetModal({ ied, signals, onClose }: {
  ied: Equipment;
  signals: BaySignal[];
  onClose: () => void;
}) {
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const eligible = signals.filter(s => s.iec61850_dataset && s.iec61850_dataset !== 'N/A' && s.iec61850_ld && s.iec61850_ln && s.iec61850_do && s.iec61850_fc);
  const byDs = new Map<string, BaySignal[]>();
  for (const s of eligible) {
    const ds = s.iec61850_dataset!;
    if (!byDs.has(ds)) byDs.set(ds, []);
    byDs.get(ds)!.push(s);
  }

  const handleFile = async (file: File) => {
    setProcessing(true);
    setError(null);
    try {
      const xmlText = await file.text();
      const iedXmlName = ied.ied_name ?? ied.code;
      const result = insertDataSetsIntoIcd(xmlText, signals, iedXmlName);
      if (!result) {
        setError('Gat ekki lesið ICD skrána eða fundið IED í henni.');
        return;
      }
      const blob = new Blob([result], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/(\.[^.]+)$/, '_updated$1') || `${ied.code}_updated.icd`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Villa kom upp.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: '520px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>DataSet / ReportControl — {ied.code}</h2>
            <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '4px 0 0' }}>
              {byDs.size > 0
                ? `Bæta við ${byDs.size} DataSet og ${byDs.size} ReportControl í ICD/IID skrá`
                : 'Engin merki með IEC 61850 DataSet gögn'}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-secondary)' }}>✕</button>
        </div>

        {byDs.size === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '13px', flex: 1 }}>
            Engin merki með <code>iec61850_dataset</code> gögn fundust fyrir þetta IED.
          </p>
        ) : (
          <>
            <div style={{ flex: 1, overflow: 'auto', marginBottom: 'var(--space-4)' }}>
              {Array.from(byDs.entries()).map(([dsName, sigs]) => {
                const rcbName = sigs.find(s => s.iec61850_rcb)?.iec61850_rcb ?? `rcb${dsName}`;
                const isBuffered = sigs[0]?.iec61850_fc === 'ST';
                return (
                  <div key={dsName} style={{ marginBottom: 'var(--space-2)', padding: '8px 12px', background: 'var(--surface-alt)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px', color: 'var(--accent)' }}>{dsName}</span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {sigs.length} FCDA · rcb: <code style={{ color: 'var(--text)' }}>{rcbName}</code> · {isBuffered ? 'buffered' : 'unbuffered'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {done ? (
              <p style={{ fontSize: '13px', color: 'var(--success)', marginBottom: 'var(--space-4)', textAlign: 'center' }}>
                ✓ Skrá uppfærð og sótt
              </p>
            ) : (
              <label style={{
                display: 'block', padding: 'var(--space-4)', border: '2px dashed var(--line)',
                borderRadius: 'var(--radius-sm)', textAlign: 'center', cursor: processing ? 'not-allowed' : 'pointer',
                color: 'var(--text-secondary)', fontSize: '13px', marginBottom: 'var(--space-4)',
                opacity: processing ? 0.6 : 1,
              }}>
                {processing ? 'Vinnur...' : '↑ Veldu ICD / IID / CID skrá til að bæta DataSet við'}
                <input type="file" accept=".icd,.iid,.cid,.scd,.xml" style={{ display: 'none' }} disabled={processing}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              </label>
            )}

            {error && <p style={{ fontSize: '12px', color: 'var(--danger)', marginBottom: 'var(--space-3)' }}>{error}</p>}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '6px 14px', fontSize: '13px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text)' }}>Loka</button>
        </div>
      </div>
    </div>
  );
}

interface SaveTemplateModalProps {
  ied: Equipment;
  allBaySignals: BaySignal[];
  bays: Bay[];
  onSaved: () => void;
  onClose: () => void;
}

function SaveTemplateModal({ ied, allBaySignals, bays, onSaved, onClose }: SaveTemplateModalProps) {
  const { api } = useApi();
  const [name, setName] = useState(`${ied.manufacturer ?? ''} ${ied.model ?? ''}`.trim() || ied.code);
  const [edition, setEdition] = useState<'1' | '2' | '2.1'>('2');
  const [description, setDescription] = useState(ied.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matching = allBaySignals.filter(s => s.equipment_code === ied.code);
  const bayCount = bays.filter(b => b.signals.some(s => s.equipment_code === ied.code)).length;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await createTemplateFromIED(api, {
        name,
        edition,
        manufacturer: ied.manufacturer ?? undefined,
        model: ied.model ?? undefined,
        description: description || undefined,
        iedCode: ied.code,
        baySignals: allBaySignals,
      });
      onSaved();
      onClose();
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('library_id')) {
        setError('Sniðmát geta ekki innihaldið sérsniðin merki. Vinsamlegast tengdu öll merkin við Merkjasafn fyrst.');
      } else {
        setError('Villa við vistun. Reyndu aftur.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: '440px', maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Gera tækjasniðmát</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-secondary)' }}>✕</button>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: 'var(--space-4)' }}>
          Safnað {matching.length} merkjum úr {bayCount} reit(um) með kóðann <strong>{ied.code}</strong>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Nafn sniðmáts
            <input
              style={{ display: 'block', width: '100%', marginTop: '2px', padding: '6px 8px', fontSize: '13px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </label>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            IEC 61850 útgáfa
            <select
              style={{ display: 'block', width: '100%', marginTop: '2px', padding: '6px 8px', fontSize: '13px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
              value={edition}
              onChange={e => setEdition(e.target.value as '1' | '2' | '2.1')}
            >
              <option value="1">Ed 1</option>
              <option value="2">Ed 2</option>
              <option value="2.1">Ed 2.1</option>
            </select>
          </label>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Lýsing
            <textarea
              style={{ display: 'block', width: '100%', marginTop: '2px', padding: '6px 8px', fontSize: '13px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', resize: 'vertical', minHeight: '60px' }}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </label>
        </div>

        {error && <p style={{ fontSize: '12px', color: 'var(--danger)', marginBottom: 'var(--space-3)' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <button type="button" onClick={onClose} style={{ padding: '6px 14px', fontSize: '13px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text)' }}>Hætta við</button>
          <button type="button" onClick={handleSave} disabled={saving || !name.trim() || matching.length === 0}
            style={{ padding: '6px 14px', fontSize: '13px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', opacity: (saving || !name.trim() || matching.length === 0) ? 0.5 : 1 }}>
            {saving ? 'Vistar...' : 'Vista'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { api, userName } = useApi();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as Tab) ?? 'bays';
  const setTab = (t: Tab) => setSearchParams(t === 'bays' ? {} : { tab: t }, { replace: true });
  const { setProject: setNavProject } = useProjectNav();
  const [project, setProject] = useState<Project | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentSha, setEquipmentSha] = useState('');
  const [templates, setTemplates] = useState<EquipmentTemplate[]>([]);
  const [bays, setBays] = useState<Bay[]>([]);
  const [eqTab, setEqTab] = useState<EqTab>('apparatus');
  const [showScd, setShowScd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [projectSha, setProjectSha] = useState('');
  const [sendingReview, setSendingReview] = useState(false);
  const [stationStatus, setStationStatus] = useState<BayStatus | null>(null);
  const [savingStation, setSavingStation] = useState(false);
  const [stationDraft, setStationDraft] = useState('');
  const [renamingProject, setRenamingProject] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState('');

  // Apparatus new row
  const [newACode, setNewACode] = useState('');
  const [newAType, setNewAType] = useState<ApparatusType>('Aflrofi');
  const [newADesc, setNewADesc] = useState('');

  // IED new row
  const [newICode, setNewICode] = useState('');
  const [newIName, setNewIName] = useState('');
  const [newITemplateId, setNewITemplateId] = useState('');
  const [newIDesc, setNewIDesc] = useState('');

  // IED models
  const [iedModels, setIedModels] = useState<Map<string, IedFcda[]>>(new Map());
  const [modelUploading, setModelUploading] = useState<string | null>(null);
  const [filterIecInvalid, setFilterIecInvalid] = useState(false);
  const [iedMismatch, setIedMismatch] = useState<{ eq: Equipment; fcda: import('../types').IedFcda[]; iedName: string } | null>(null);

  // Save template modal
  const [saveTemplateIed, setSaveTemplateIed] = useState<Equipment | null>(null);
  const [allBaySignals, setAllBaySignals] = useState<BaySignal[]>([]);
  const [dataSetIed, setDataSetIed] = useState<Equipment | null>(null);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      loadProject(api, projectId),
      listBays(api, projectId),
      api.readJson<EquipmentTemplate[]>('data/equipment_templates.json').catch(() => ({ data: [], sha: '' })),
      loadStation(api, projectId).catch(() => null),
    ]).then(([files, bayList, { data: tmplData }, stationFile]) => {
      setProject(files.project);
      setNavProject(projectId!, files.project.name);
      setProjectSha(files.projectSha);
      setStationDraft(files.project.station_number);
      setEquipment(files.equipment);
      setEquipmentSha(files.equipmentSha);
      setBays(bayList);
      setAllBaySignals(bayList.flatMap(b => b.signals));
      setTemplates(tmplData);
      setStationStatus(stationFile?.station.status ?? null);
    }).catch(() => {
      setLoadError('Gat ekki hlaðið verkefni. Það gæti verið ófullkomið eða eytt.');
    }).finally(() => setLoading(false));
  }, [api, projectId]);

  // Re-fetch bays when Reitir tab is opened (catches updates from BayView)
  useEffect(() => {
    if (tab !== 'bays' || !projectId || loading) return;
    listBays(api, projectId).then(bayList => {
      setBays(bayList);
      setAllBaySignals(bayList.flatMap(b => b.signals));
    }).catch(() => {});
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // When IED template changes, auto-fill description
  useEffect(() => {
    const tmpl = templates.find(t => t.id === newITemplateId);
    if (tmpl) setNewIDesc(tmpl.description ?? '');
  }, [newITemplateId, templates]);

  // Check which IEDs have models loaded
  useEffect(() => {
    if (!projectId) return;
    const ieds = equipment.filter(e => e.category === 'ied');
    if (ieds.length === 0) return;
    Promise.all(
      ieds.map(async eq => {
        const model = await loadIedModel(api, projectId, eq.id);
        return { id: eq.id, model };
      })
    ).then(results => {
      setIedModels(prev => {
        const next = new Map(prev);
        results.forEach(({ id, model }) => {
          if (model && model.length > 0) {
            next.set(id, model);
          }
        });
        return next;
      });
    });
  }, [api, projectId, equipment]);

  const handleUploadIcd = async (eq: Equipment, file: File) => {
    if (!projectId) return;
    setModelUploading(eq.id);
    try {
      const xmlText = await file.text();
      const result = parseModel(xmlText);
      if (result.error) { alert(result.error); return; }
      const { fcda, iedName, manufacturer, typeCode, configVersion } = result;
      const expectedName = eq.code;
      if (iedName && iedName !== expectedName) {
        setIedMismatch({ eq, fcda, iedName });
        return;
      }
      await saveModel(api, projectId, eq.id, fcda, iedName);
      setIedModels(prev => new Map(prev).set(eq.id, fcda));
      const patch: Partial<Equipment> = {};
      if (manufacturer) patch.manufacturer = manufacturer;
      if (typeCode) patch.model = typeCode;
      if (configVersion) patch.config_version = configVersion;
      if (Object.keys(patch).length > 0) await handleUpdate(eq.id, patch);
    } finally {
      setModelUploading(null);
    }
  };

  const handleMismatchUseFileName = async () => {
    if (!iedMismatch || !projectId) return;
    const { eq, fcda, iedName } = iedMismatch;
    setIedMismatch(null);
    setModelUploading(eq.id);
    try {
      const updated = equipment.map(e => e.id === eq.id ? { ...e, ied_name: iedName } : e);
      await saveEquipment(updated);
      await saveModel(api, projectId, eq.id, fcda, iedName);
      setIedModels(prev => new Map(prev).set(eq.id, fcda));
    } finally {
      setModelUploading(null);
    }
  };

  const handleMismatchContinue = async () => {
    if (!iedMismatch || !projectId) return;
    const { eq, fcda, iedName } = iedMismatch;
    setIedMismatch(null);
    setModelUploading(eq.id);
    try {
      await saveModel(api, projectId, eq.id, fcda, iedName);
      setIedModels(prev => new Map(prev).set(eq.id, fcda));
    } finally {
      setModelUploading(null);
    }
  };

  const saveEquipment = async (updated: Equipment[]) => {
    const msg = `[DESIGN] Uppfæra tæki`;
    const newSha = await api.writeJson(`projects/${projectId}/equipment.json`, updated, equipmentSha, msg);
    setEquipment(updated);
    setEquipmentSha(newSha);
  };

  const commitStationNumber = async () => {
    if (!project || !projectId) return;
    const next = stationDraft;
    if (!next || next === project.station_number) {
      // Reset draft to committed value (in case user cleared and blurred)
      setStationDraft(project.station_number);
      return;
    }
    setSavingStation(true);
    const previous = project.station_number;
    try {
      const updated: Project = { ...project, station_number: next };
      const newSha = await api.writeJson(
        `projects/${projectId}/project.json`, updated, projectSha,
        `Uppfæra stöðvarnúmer: ${previous} → ${next}`
      );
      setProject(updated);
      setProjectSha(newSha);
      await renameStation(api, projectId, next);
      const bayList = await listBays(api, projectId);
      setBays(bayList);
    } catch (err) {
      console.error('Failed to update station number', err);
      alert('Villa við að uppfæra stöðvarnúmer. Endurhlaða verkefnið til að sjá stöðu.');
      // Reload to reflect actual server state after partial failure
      try {
        const [files, bayList] = await Promise.all([
          loadProject(api, projectId),
          listBays(api, projectId),
        ]);
        setProject(files.project);
        setProjectSha(files.projectSha);
        setStationDraft(files.project.station_number);
        setBays(bayList);
      } catch {
        // ignore secondary failure
      }
    } finally {
      setSavingStation(false);
    }
  };

  const commitProjectName = async () => {
    if (!project || !projectId) return;
    const next = projectNameDraft.trim();
    if (!next || next === project.name) { setRenamingProject(false); return; }
    try {
      const updated: Project = { ...project, name: next };
      const newSha = await api.writeJson(
        `projects/${projectId}/project.json`, updated, projectSha,
        `Endurnefna verkefni: ${project.name} → ${next}`
      );
      setProject(updated);
      setProjectSha(newSha);
      setNavProject(projectId!, next);
    } catch { alert('Villa við að endurnefna verkefni.'); }
    setRenamingProject(false);
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

  const handleDeleteBay = async (bayId: string, displayId: string) => {
    if (!projectId) return;
    if (!confirm(`Eyða reit ${displayId}?`)) return;
    setSendingReview(true);
    try {
      const bayFile = await loadBay(api, projectId, bayId);
      await deleteBay(api, projectId, bayFile, userName);
      setBays(prev => prev.filter(b => b.id !== bayId));
    } catch {
      alert('Villa við að eyða reit. Reyndu aftur.');
    } finally {
      setSendingReview(false);
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

  const TYPE_ORDER: Record<string, number> = { Aflrofi: 0, Skilrofi: 1, Jarðrofi: 2, Spennir: 3, Vörn: 4, Stjórnbúnaður: 5, Annað: 6 };
  const apparatus = equipment
    .filter(e => e.category === 'apparatus' || !e.category)
    .sort((a, b) => {
      const ta = TYPE_ORDER[a.type ?? 'Annað'] ?? 6;
      const tb = TYPE_ORDER[b.type ?? 'Annað'] ?? 6;
      if (ta !== tb) return ta - tb;
      return a.code.localeCompare(b.code, 'is');
    });
  const ieds = equipment
    .filter(e => e.category === 'ied')
    .sort((a, b) => a.code.localeCompare(b.code, 'is'));

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {renamingProject ? (
              <input
                autoFocus
                value={projectNameDraft}
                onChange={e => setProjectNameDraft(e.target.value)}
                onBlur={commitProjectName}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenamingProject(false); }}
                style={{ fontSize: '20px', fontWeight: 700, background: 'var(--surface-alt)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '1px 6px', outline: 'none', width: '260px' }}
              />
            ) : (
              <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>{project.name}</h1>
            )}
            <button type="button" onClick={() => { setProjectNameDraft(project.name); setRenamingProject(true); }}
              title="Endurnefna verkefni"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '13px', padding: '2px 4px', lineHeight: 1 }}>✏</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '2px' }}>
            <label style={{ fontSize: '12px', color: 'var(--muted)' }}>Stöðvarnúmer:</label>
            <input
              type="text"
              inputMode="numeric"
              value={stationDraft}
              onChange={e => setStationDraft(e.target.value.replace(/\D/g, '').slice(0, 10))}
              onBlur={commitStationNumber}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              disabled={savingStation}
              title="Breyting vistast þegar reitur tapar fókus"
              style={{
                width: '80px', padding: '2px 6px', fontSize: '12px',
                background: 'var(--surface-alt)', border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              }}
            />
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              · {apparatus.length} búnaður · {ieds.length} IED · {bays.length} reitir
            </span>
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
      {tab === 'bays' && (() => {
        // Build code→model map (iedModels is keyed by equipment.id, signals use equipment.code)
        const codeToModel = new Map<string, IedFcda[]>();
        equipment.forEach(eq => { const m = iedModels.get(eq.id); if (m) codeToModel.set(eq.code, m); });

        const bayIecInvalidCount = (bay: Bay) => bay.signals.filter(sig => {
          const model = codeToModel.get(sig.iec61850_ied ?? '');
          if (!model || !sig.iec61850_ln) return false;
          return model.filter(f =>
            (!sig.iec61850_ld || f.ldInst === sig.iec61850_ld) &&
            (!sig.iec61850_ln_prefix || f.prefix === sig.iec61850_ln_prefix) &&
            f.lnClass === sig.iec61850_ln &&
            (!sig.iec61850_ln_inst || f.lnInst === sig.iec61850_ln_inst) &&
            (!sig.iec61850_do || f.doName === sig.iec61850_do) &&
            (!sig.iec61850_da || f.daName === sig.iec61850_da)
          ).length === 0;
        }).length;

        const totalIecInvalid = bays.reduce((n, b) => n + bayIecInvalidCount(b), 0);
        const visibleBays = filterIecInvalid ? bays.filter(b => bayIecInvalidCount(b) > 0) : bays;

        return (
        <div>
          <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            {bays.length > 0 && bays.every(b => b.status === 'LOCKED') && (
              <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>✓ Allt læst</span>
            )}
            {totalIecInvalid > 0 && (
              <button type="button" onClick={() => setFilterIecInvalid(f => !f)} style={{
                fontSize: '12px', padding: '3px 10px', cursor: 'pointer',
                borderRadius: 'var(--radius-sm)', border: `1px solid ${filterIecInvalid ? 'var(--warn, #f59e0b)' : 'var(--line)'}`,
                background: filterIecInvalid ? 'color-mix(in srgb, var(--warn, #f59e0b) 12%, transparent)' : 'var(--surface-alt)',
                color: filterIecInvalid ? 'var(--warn, #f59e0b)' : 'var(--text-secondary)',
                fontWeight: filterIecInvalid ? 700 : 400,
              }} title="Sía reitir með IEC 61850 villur">⚠ {totalIecInvalid} IEC villa</button>
            )}
            {bays.some(b => b.status === 'DRAFT') && (
              <Button variant="ghost" size="sm" onClick={handleSendAllForReview} disabled={sendingReview}>→ Senda alla í yfirferð</Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => exportAllBaysToExcel(bays, project?.name ?? 'verkefni')}>↓ Excel (allt)</Button>
            <Button onClick={() => navigate(`/projects/${projectId}/bays/new`)}>+ Nýr reitur</Button>
          </div>
          {visibleBays.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--muted)' }}>
              {filterIecInvalid ? 'Engir reitir með IEC 61850 villur.' : 'Engir reitir enn. Bættu við nýjum reit.'}
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {visibleBays.map(bay => {
                const statusColor = bay.status === 'LOCKED' ? 'var(--success)' : bay.status === 'IN_REVIEW' ? 'var(--accent)' : 'var(--warn)';
                const statusLabel = bay.status === 'LOCKED' ? 'LÆST' : bay.status === 'IN_REVIEW' ? 'Í YFIRFERÐ' : 'DRAFT';
                const iecCount = bayIecInvalidCount(bay);
                return (
                  <Card key={bay.id} padding="var(--space-4) var(--space-5)" style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/projects/${projectId}/bays/${bay.id}`)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{bay.display_id}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {bay.description && <span style={{ marginRight: '6px', color: 'var(--text-secondary)' }}>{bay.description}</span>}
                          {bay.signals.length} merki · {new Set(bay.signals.map(s => s.equipment_code)).size} tæki
                          {bay.signals.some(s => s.review_flagged) && (
                            <span style={{ marginLeft: '8px', color: 'var(--danger)', fontWeight: 600 }}>
                              · 💬 {bay.signals.filter(s => s.review_flagged).length} til skoðunar
                            </span>
                          )}
                          {iecCount > 0 && (
                            <span style={{ marginLeft: '8px', color: 'var(--warn, #f59e0b)', fontWeight: 600 }}>
                              · ⚠ {iecCount} IEC villa
                            </span>
                          )}
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
                          <>
                            <Button size="sm" variant="ghost" disabled={sendingReview}
                              onClick={e => { e.stopPropagation(); handleSendBayForReview(bay.id); }}>
                              → Yfirferð
                            </Button>
                            <Button size="sm" variant="danger" disabled={sendingReview}
                              onClick={e => { e.stopPropagation(); handleDeleteBay(bay.id, bay.display_id); }}>
                              Eyða
                            </Button>
                          </>
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
        );
      })()}

      {/* Tæki */}
      {tab === 'equipment' && (
        <div>
          {/* Sub-tabs + toolbar í sömu línu */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            {([['apparatus', `Búnaður (${apparatus.length})`], ['ied', `IED (${ieds.length})`]] as [EqTab, string][]).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setEqTab(id)} style={{
                background: eqTab === id ? 'var(--accent)' : 'var(--surface-alt)',
                color: eqTab === id ? 'white' : 'var(--text-secondary)',
                border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
                padding: '5px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
              }}>{label}</button>
            ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button variant="ghost" size="sm" onClick={() => exportEquipmentTemplate(equipment, project.name)}>
                ↓ Excel sniðmát
              </Button>
              <label style={{
                display: 'inline-flex', alignItems: 'center', cursor: saving ? 'not-allowed' : 'pointer',
                padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)',
                background: 'transparent', color: 'var(--text)', fontWeight: 500, fontSize: '13px',
                opacity: saving ? 0.5 : 1,
              }}>
                ↑ Innflytja Excel
                <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} disabled={saving} onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = '';
                  setSaving(true);
                  try {
                    const imported = await importEquipmentFromExcel(file);
                    if (imported.length === 0) { alert('Engar línur fundust í skránni.'); return; }
                    const existing = equipment.map(eq => eq.code);
                    const fresh = imported.filter(eq => !existing.includes(eq.code));
                    const dupes = imported.length - fresh.length;
                    if (!confirm(`Bæta við ${fresh.length} tækjum?${dupes > 0 ? ` (${dupes} sleppt — kóðar eru nú þegar til)` : ''}`)) return;
                    await saveEquipment([...equipment, ...fresh]);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Villa við innflutning');
                  } finally { setSaving(false); }
                }} />
              </label>
            </div>
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
                        defaultValue={eq.code} key={`ac-${eq.id}-${eq.code}`}
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
                      <input style={editInput} defaultValue={eq.description} key={`ad-${eq.id}-${eq.description}`}
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
                  {['Tech key', 'IED nafn', 'Sniðmát', 'Framleiðandi', 'Tegund', 'Versía', 'Lýsing', ''].map(h => <th key={h} style={headStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {ieds.map(eq => (
                  <tr key={eq.id}>
                    <td style={{ ...cellStyle, minWidth: '80px' }}>
                      <input style={{ ...editInput, fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}
                        defaultValue={eq.code} key={`ic-${eq.id}-${eq.code}`}
                        onFocus={focusInput} onBlur={e => { blurInput(e); const v = e.target.value.trim().toUpperCase(); if (v && v !== eq.code) handleUpdate(eq.id, { code: v }); }}
                        onChange={() => {}} />
                    </td>
                    <td style={{ ...cellStyle, minWidth: '90px' }}>
                      <input style={{ ...editInput, fontFamily: 'monospace' }}
                        defaultValue={eq.ied_name ?? ''} key={`in-${eq.id}-${eq.ied_name}`} placeholder="Q0IED"
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
                      <input style={editInput} defaultValue={eq.manufacturer ?? ''} key={`im-${eq.id}-${eq.manufacturer}`}
                        placeholder="ABB" onFocus={focusInput}
                        onBlur={e => { blurInput(e); handleUpdate(eq.id, { manufacturer: e.target.value || null }); }}
                        onChange={() => {}} />
                    </td>
                    <td style={{ ...cellStyle, minWidth: '80px' }}>
                      <input style={editInput} defaultValue={eq.model ?? ''} key={`imd-${eq.id}-${eq.model}`}
                        placeholder="REL670" onFocus={focusInput}
                        onBlur={e => { blurInput(e); handleUpdate(eq.id, { model: e.target.value || null }); }}
                        onChange={() => {}} />
                    </td>
                    <td style={{ ...cellStyle, minWidth: '100px' }}>
                      <input style={editInput} defaultValue={eq.config_version ?? ''} key={`icv-${eq.id}-${eq.config_version}`}
                        placeholder="ver1.2.3" onFocus={focusInput}
                        onBlur={e => { blurInput(e); handleUpdate(eq.id, { config_version: e.target.value || null }); }}
                        onChange={() => {}} />
                    </td>
                    <td style={{ ...cellStyle, width: '100%' }}>
                      <input style={editInput} defaultValue={eq.description} key={`id-${eq.id}-${eq.description}`}
                        placeholder="Lýsing" onFocus={focusInput}
                        onBlur={e => { blurInput(e); handleUpdate(eq.id, { description: e.target.value }); }}
                        onChange={() => {}} />
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <label style={{ cursor: 'pointer' }}>
                          <input type="file" accept=".icd,.iid,.cid,.scd,.xml" style={{ display: 'none' }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadIcd(eq, f); e.target.value = ''; }} />
                          <span style={{
                            display: 'inline-block', padding: '3px 8px', fontSize: '11px',
                            border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer', whiteSpace: 'nowrap',
                            background: iedModels.has(eq.id) ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                            color: iedModels.has(eq.id) ? 'var(--accent)' : 'var(--text-secondary)',
                          }}>
                            {modelUploading === eq.id ? '...' : iedModels.has(eq.id) ? `✓ ${iedModels.get(eq.id)!.length} merki` : '📂 ICD'}
                          </span>
                        </label>
                        {allBaySignals.some(s => s.equipment_code === eq.code) && (
                          <button
                            type="button"
                            onClick={() => setSaveTemplateIed(eq)}
                            style={{
                              display: 'inline-block', padding: '3px 8px', fontSize: '11px',
                              border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)',
                              whiteSpace: 'nowrap',
                            }}
                            title="Gera tækjasniðmát úr þessum IED"
                          >
                            ⊕ Sniðmát
                          </button>
                        )}
                        {allBaySignals.some(s => s.iec61850_ied === eq.code && s.iec61850_dataset && s.iec61850_dataset !== 'N/A') && (
                          <button
                            type="button"
                            onClick={() => setDataSetIed(eq)}
                            style={{
                              display: 'inline-block', padding: '3px 8px', fontSize: '11px',
                              border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer', background: 'transparent', color: 'var(--text-secondary)',
                              whiteSpace: 'nowrap',
                            }}
                            title="Búa til DataSet og ReportControl"
                          >
                            ⊞ DataSet
                          </button>
                        )}
                        <Button variant="danger" size="sm" disabled={saving} onClick={() => handleDelete(eq.id)}>Eyða</Button>
                      </div>
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
                  <td style={{ padding: '6px 10px' }} colSpan={4}>
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

      {iedMismatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 'var(--space-5)', maxWidth: '420px', width: '100%' }}>
            <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>IED nafn passar ekki</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              <div>Nafn í skrá: <strong style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{iedMismatch.iedName}</strong></div>
              <div>Tech key tækis: <strong style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{iedMismatch.eq.code}</strong></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Button onClick={handleMismatchUseFileName}>Nota nafn úr skrá og uppfæra tæki</Button>
              <Button variant="ghost" onClick={handleMismatchContinue}>Halda áfram þótt nöfn séu mismunandi</Button>
              <Button variant="ghost" onClick={() => setIedMismatch(null)}>Hætta við</Button>
            </div>
          </div>
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

      {dataSetIed && (
        <DataSetModal
          ied={dataSetIed}
          signals={allBaySignals.filter(s => s.iec61850_ied === dataSetIed.code)}
          onClose={() => setDataSetIed(null)}
        />
      )}

      {saveTemplateIed && (
        <SaveTemplateModal
          ied={saveTemplateIed}
          allBaySignals={allBaySignals}
          bays={bays}
          onSaved={() => {}}
          onClose={() => setSaveTemplateIed(null)}
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
        <OverviewTab projectId={projectId} projectName={project.name} projectPhase={project.phase} />
      )}
      {tab === 'changelog' && projectId && <ChangelogTab projectId={projectId} />}
    </div>
  );
}
