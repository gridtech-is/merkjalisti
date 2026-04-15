// src/pages/NewProject.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { createProject, saveProject } from '../services/projectService';
import { Card, Button, Input } from '../components/ui';
import { EquipmentList } from '../components/EquipmentList';
import type { Equipment } from '../types';

type Step = 'name' | 'equipment';

export function NewProject() {
  const { api, userName } = useApi();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const files = await createProject(api, name.trim(), userName);
      if (equipment.length > 0) {
        await saveProject(api, { ...files, equipment });
      }
      navigate(`/projects/${files.project.id}`);
    } catch {
      setError('Villa við að búa til verkefni. Reyndu aftur.');
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Button variant="ghost" size="sm" onClick={() => step === 'equipment' ? setStep('name') : navigate('/')}>
          ← Til baka
        </Button>
      </div>

      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 'var(--space-6)' }}>
        Nýtt verkefni
      </h1>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
        {(['name', 'equipment'] as Step[]).map((s, i) => (
          <div key={s} style={{
            padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
            background: step === s ? 'var(--accent)' : 'var(--surface-alt)',
            color: step === s ? '#0f172a' : 'var(--muted)',
          }}>
            {i + 1}. {s === 'name' ? 'Stöðarheiti' : 'Tæki'}
          </div>
        ))}
      </div>

      <Card>
        {step === 'name' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <Input
              label="Heiti dreifistöðvar / stöðvar"
              value={name}
              onChange={setName}
              placeholder="t.d. Hamrahlíð 66kV"
              required
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <Button variant="ghost" onClick={() => navigate('/')}>Hætta við</Button>
              <Button
                onClick={() => setStep('equipment')}
                disabled={!name.trim()}
              >
                Áfram →
              </Button>
            </div>
          </div>
        )}

        {step === 'equipment' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Skilgreindu tæki á stöðinni. Hægt að bæta við fleiri síðar.
            </p>
            <EquipmentList equipment={equipment} onChange={setEquipment} />
            {error && <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <Button variant="ghost" onClick={() => setStep('name')}>← Til baka</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Vista...' : 'Búa til verkefni'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
