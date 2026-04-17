// src/components/EquipmentList.tsx
import { Button, Input, Select } from './ui';
import type { Equipment, EquipmentType } from '../types';

const EQUIPMENT_TYPES: { value: EquipmentType; label: string }[] = [
  { value: 'Aflrofi', label: 'Aflrofi (CB)' },
  { value: 'Skilrofi', label: 'Skilrofi (DS)' },
  { value: 'Jarðrofi', label: 'Jarðrofi (ES)' },
  { value: 'Spennir', label: 'Spennir (TR)' },
  { value: 'Vörn', label: 'Vörn / Vernd' },
  { value: 'Stjórnbúnaður', label: 'Stjórnbúnaður' },
  { value: 'Annað', label: 'Annað' },
];

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

interface Props {
  equipment: Equipment[];
  onChange: (equipment: Equipment[]) => void;
}

export function EquipmentList({ equipment, onChange }: Props) {
  const add = () => {
    onChange([...equipment, {
      id: uuid(), category: 'apparatus', type: 'Aflrofi', code: '', ied_name: null, manufacturer: null, model: null, template_id: null, description: '',
    }]);
  };

  const update = (id: string, patch: Partial<Equipment>) => {
    onChange(equipment.map(e => e.id === id ? { ...e, ...patch } : e));
  };

  const remove = (id: string) => {
    onChange(equipment.filter(e => e.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {equipment.map((eq, i) => (
        <div
          key={eq.id}
          style={{
            background: 'var(--surface-alt)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-4)',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Tæki {i + 1}
            </span>
            <Button variant="danger" size="sm" onClick={() => remove(eq.id)}>Eyða</Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Select
              label="Tegund"
              value={eq.type ?? 'Annað'}
              onChange={v => update(eq.id, { type: v as EquipmentType })}
              options={EQUIPMENT_TYPES}
            />
            <Input
              label="Kóði (t.d. QA1, BCF1)"
              value={eq.code}
              onChange={v => update(eq.id, { code: v.toUpperCase() })}
              placeholder="QA1"
              required
            />
          </div>
          <Input
            label="IED nafn (t.d. 55E00BCF1)"
            value={eq.ied_name ?? ''}
            onChange={v => update(eq.id, { ied_name: v || null })}
            placeholder="55E00BCF1"
            hint="Má bæta við fleiri síðar"
          />
          <Input
            label="Lýsing (valkvæmt)"
            value={eq.description}
            onChange={v => update(eq.id, { description: v })}
            placeholder="t.d. Línuvernd REF615"
          />
        </div>
      ))}
      <Button variant="ghost" onClick={add}>
        + Bæta við tæki
      </Button>
    </div>
  );
}
