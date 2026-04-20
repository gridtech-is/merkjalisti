import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { createBay, listBayTemplates } from '../services/bayService';
import { Card, Button, Input, Select } from '../components/ui';
import type { BaySignal, BayTemplate, Project } from '../types';

export function NewBay() {
  const { projectId } = useParams<{ projectId: string }>();
  const { api, userName } = useApi();
  const navigate = useNavigate();
  const [stationNumber, setStationNumber] = useState('');
  const [voltageLevel, setVoltageLevel] = useState('J');
  const [bayName, setBayName] = useState('');
  const [templates, setTemplates] = useState<BayTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    api.readJson<Project>(`projects/${projectId}/project.json`)
      .then(({ data }) => setStationNumber(data.station_number))
      .catch(() => setError('Gat ekki sótt stöðvarnúmer verkefnis.'));
    listBayTemplates(api).then(setTemplates).catch(() => {});
  }, [api, projectId]);

  const handleCreate = async () => {
    if (!stationNumber || !bayName.trim() || !projectId) return;
    setSaving(true);
    setError('');
    try {
      let signals: BaySignal[] = [];
      if (selectedTemplate) {
        const tmpl = templates.find(t => t.template_name === selectedTemplate);
        if (tmpl) {
          signals = tmpl.signals.map(s => ({
            ...s,
            phase_added: 'DESIGN' as const,
          }));
        }
      }
      const { bay } = await createBay(
        api, projectId, stationNumber, voltageLevel, bayName.trim().toUpperCase(), signals, userName
      );
      navigate(`/projects/${projectId}/bays/${bay.id}`);
    } catch {
      setError('Villa við að búa til reit. Reyndu aftur.');
      setSaving(false);
    }
  };

  const displayId = stationNumber && bayName ? `${stationNumber}${bayName.toUpperCase()}` : '';

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}`)}>
          ← Til baka
        </Button>
      </div>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 'var(--space-6)' }}>
        Nýr reitur
      </h1>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 'var(--space-3)' }}>
            <Input
              label="Spennutig"
              value={voltageLevel}
              onChange={setVoltageLevel}
              placeholder="J"
            />
            <Input
              label="Bay nafn"
              value={bayName}
              onChange={setBayName}
              placeholder="E00"
              required
            />
          </div>

          {displayId && (
            <div style={{
              background: 'var(--surface-alt)', borderRadius: 'var(--radius)',
              padding: 'var(--space-3)', fontSize: '13px', color: 'var(--text-secondary)',
            }}>
              Display ID: <strong style={{ color: 'var(--accent)' }}>{displayId}</strong>
            </div>
          )}

          <Select
            label="Sniðmát (valkvæmt)"
            value={selectedTemplate}
            onChange={setSelectedTemplate}
            options={[
              { value: '', label: '— Engin sniðmát —' },
              ...templates.map(t => ({ value: t.template_name, label: t.template_name })),
            ]}
          />

          {selectedTemplate && (
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {templates.find(t => t.template_name === selectedTemplate)?.signals.length ?? 0} merki verða flutt inn
            </div>
          )}

          {error && <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <Button variant="ghost" onClick={() => navigate(`/projects/${projectId}`)}>
              Hætta við
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !stationNumber || !bayName.trim()}
            >
              {saving ? 'Vista...' : 'Búa til reit'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
