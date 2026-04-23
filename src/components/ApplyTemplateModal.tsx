// src/components/ApplyTemplateModal.tsx
import { useState } from 'react';
import { Button } from './ui';
import { applyTemplateToBay } from '../services/equipmentTemplateService';
import type { BaySignal, Equipment, EquipmentTemplate } from '../types';

interface Props {
  ied: Equipment;
  templates: EquipmentTemplate[];
  baySignals: BaySignal[];
  onApply: (updated: BaySignal[], matchedCount: number) => void;
  onClose: () => void;
}

export function ApplyTemplateModal({ ied, templates, baySignals, onApply, onClose }: Props) {
  const [selected, setSelected] = useState<string>('');

  const matchingTemplates = templates.filter(
    t => t.category === 'ied' && t.signals.length > 0 && (
      !ied.model || !t.model || t.model.toLowerCase().includes(ied.model.toLowerCase()) || ied.model.toLowerCase().includes(t.model.toLowerCase())
    )
  );
  const displayTemplates = matchingTemplates.length > 0 ? matchingTemplates : templates.filter(t => t.category === 'ied' && t.signals.length > 0);

  const selectedTemplate = displayTemplates.find(t => t.id === selected);
  const preview = selectedTemplate
    ? applyTemplateToBay(selectedTemplate, ied.code, baySignals)
    : null;

  const handleApply = () => {
    if (!selectedTemplate || !preview) return;
    onApply(preview.updated, preview.matchedCount);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: '480px', maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Beita sniðmáti á {ied.code}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
        </div>

        {displayTemplates.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Engin signal-sniðmát fundust. Búðu til sniðmát í Merkjasafni fyrst.</p>
        ) : (
          <>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Veldu sniðmát</label>
              <select
                style={{ width: '100%', padding: '6px 8px', fontSize: '13px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
                value={selected}
                onChange={e => setSelected(e.target.value)}
              >
                <option value="">— Veldu —</option>
                {displayTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}{t.iec61850_edition ? ` (Ed ${t.iec61850_edition})` : ''} · {t.signals.length} merki</option>
                ))}
              </select>
            </div>

            {preview && (
              <div style={{ fontSize: '13px', marginBottom: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--surface-alt)', borderRadius: 'var(--radius-sm)', color: preview.matchedCount > 0 ? 'var(--text)' : 'var(--muted)' }}>
                {preview.matchedCount > 0
                  ? `Mun uppfæra IEC61850 á ${preview.matchedCount} merkjum í reitnum`
                  : `0 af ${baySignals.filter(s => s.equipment_code === ied.code).length} merkjum passaði`
                }
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button size="sm" variant="ghost" onClick={onClose}>Hætta við</Button>
              <Button size="sm" onClick={handleApply} disabled={!selected || !preview || preview.matchedCount === 0}>Beita</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
