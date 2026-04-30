// src/components/SignalFormModal.tsx
import { useState } from 'react';
import { Modal, Input, Select, Button } from './ui';
import { useLibrary } from '../context/LibraryContext';
import type { BaySignal, SignalLibraryEntry, ProjectPhase, Equipment } from '../types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

interface Props {
  phase: ProjectPhase;
  equipment: Equipment[];
  onAdd: (signals: BaySignal[]) => void;
  onClose: () => void;
}

export function SignalPickerModal({ phase, equipment, onAdd, onClose }: Props) {
  const { signalLibrary: library, loading } = useLibrary();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Default to Vörn equipment, otherwise first in list
  const defaultEquipment = (
    equipment.find(e => e.type === 'Vörn') ?? equipment[0]
  )?.code ?? '';
  const [equipmentCode, setEquipmentCode] = useState(defaultEquipment);

  const norm = (s: string) => s.toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o')
    .replace(/ú/g, 'u').replace(/ý/g, 'y').replace(/ð/g, 'd').replace(/þ/g, 'th')
    .replace(/æ/g, 'ae').replace(/ö/g, 'o');

  const scoreEntry = (e: SignalLibraryEntry, tokens: string[]): number => {
    const fields = [
      norm(e.code ?? ''), norm(e.name_is), norm(e.name_en ?? ''),
    ];
    if (!tokens.every(t => fields.some(f => f.includes(t)))) return -1;
    if (fields[0].startsWith(tokens[0])) return 2;
    if (fields.some(f => f.startsWith(tokens[0]))) return 1;
    return 0;
  };

  const tokens = norm(search).split(/\s+/).filter(Boolean);
  const filtered = tokens.length === 0
    ? library
    : library
        .map(e => ({ e, score: scoreEntry(e, tokens) }))
        .filter(x => x.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.e);

  const toggle = (code: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleAdd = () => {
    const eqCode = equipmentCode.trim();
    const signals: BaySignal[] = library
      .filter(e => e.code && selected.has(e.code))
      .map(e => ({
        id: uuid(),
        equipment_code: eqCode,
        signal_name: e.code ?? '',
        name_is: e.name_is,
        name_en: e.name_en ?? null,
        state_id: e.state_id ?? null,
        iec61850_ied: null,
        iec61850_ln_prefix: null,
        iec61850_ln_inst: null,
        iec61850_rcb: null,
        iec61850_dataset_entry: null,
        iec61850_ld: null,
        iec61850_ln: e.iec61850_ln ?? null,
        iec61850_do: e.iec61850_do ?? null,
        iec61850_da: e.iec61850_da ?? null,
        iec61850_fc: e.iec61850_fc ?? null,
        iec61850_cdc: e.iec61850_cdc ?? null,
        iec61850_dataset: e.iec61850_dataset ?? null,
        library_id: e.id,
        unit_id: e.unit_id ?? null,
        is_alarm: e.is_alarm,
        alarm_class: e.alarm_class ?? null,
        state_alarm_map: null,
        source_type: e.source_type,
        phase_added: phase,
        fat_tested: false,
        fat_tested_by: null,
        fat_tested_at: null,
        fat_result: null,
        sat_tested: false,
        sat_tested_by: null,
        sat_tested_at: null,
        sat_result: null,
        review_flagged: false,
        review_comment: null,
      }));
    onAdd(signals);
  };

  const canAdd = selected.size > 0 && equipmentCode.trim().length > 0;

  const rowStyle = (isSelected: boolean): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: '32px 100px 1fr 1fr 60px',
    gap: '8px',
    padding: '6px 8px',
    borderBottom: '1px solid var(--line-muted)',
    fontSize: '12px',
    cursor: 'pointer',
    background: isSelected ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
    alignItems: 'center',
  });

  return (
    <Modal title="Bæta við merkjum úr safni" onClose={onClose} width="700px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {equipment.length > 0 ? (
          <Select
            label="Tæki (gildir fyrir öll valin merki)"
            value={equipmentCode}
            onChange={setEquipmentCode}
            options={[...equipment].sort((a, b) => {
              const ORDER: Record<string, number> = { Aflrofi: 0, Skilrofi: 1, Jarðrofi: 2, Spennir: 3, Vörn: 4, Stjórnbúnaður: 5, Annað: 6 };
              const ta = a.category === 'ied' ? 7 : (ORDER[a.type ?? 'Annað'] ?? 6);
              const tb = b.category === 'ied' ? 7 : (ORDER[b.type ?? 'Annað'] ?? 6);
              if (ta !== tb) return ta - tb;
              return a.code.localeCompare(b.code, 'is');
            }).map(e => ({
              value: e.code,
              label: e.category === 'ied'
                ? `${e.code} — IED${e.model ? ` ${e.model}` : ''}${e.ied_name ? ` (${e.ied_name})` : ''}`
                : `${e.code} — ${e.type ?? ''}${e.description ? `: ${e.description}` : ''}`,
            }))}
            required
          />
        ) : (
          <Input
            label="Tækjakóði (gildir fyrir öll valin merki)"
            value={equipmentCode}
            onChange={v => setEquipmentCode(v.toUpperCase())}
            placeholder="t.d. QA1, BCF1"
            required
          />
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)' }}>
          <div style={{ flex: 1 }}>
            <Input
              label="Leita í safni"
              value={search}
              onChange={setSearch}
              placeholder="Leitaðu að kóða eða heiti..."
            />
          </div>
        </div>

        {selected.size > 0 && (
          <div style={{ fontSize: '12px', color: 'var(--accent)' }}>
            {selected.size} merki valin
          </div>
        )}

        <div style={{
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          maxHeight: '380px',
          overflowY: 'auto',
        }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '32px 100px 1fr 1fr 60px',
            gap: '8px',
            padding: '6px 8px',
            background: 'var(--surface-alt)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            position: 'sticky',
            top: 0,
          }}>
            <div></div>
            <div>Kóði</div>
            <div>Heiti (IS)</div>
            <div>Heiti (EN)</div>
            <div>Alarm</div>
          </div>

          {loading && (
            <div style={{ padding: 'var(--space-6)', color: 'var(--muted)', textAlign: 'center', fontSize: '13px' }}>
              Hleður safn...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: 'var(--space-6)', color: 'var(--muted)', textAlign: 'center', fontSize: '13px' }}>
              Ekkert fannst
            </div>
          )}

          {!loading && filtered.map(e => {
            const code = e.code ?? '';
            const isSelected = selected.has(code);
            return (
              <div
                key={code || e.name_is}
                style={rowStyle(isSelected)}
                onClick={() => code && toggle(code)}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => code && toggle(code)}
                  onClick={ev => ev.stopPropagation()}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent)' }}>{code}</span>
                <span>{e.name_is}</span>
                <span style={{ color: 'var(--muted)' }}>{e.name_en ?? ''}</span>
                <span style={{ color: e.is_alarm ? 'var(--danger)' : 'var(--muted)', fontSize: '11px' }}>
                  {e.is_alarm ? `F${e.alarm_class}` : '—'}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <Button variant="ghost" onClick={onClose}>Hætta við</Button>
          <Button onClick={handleAdd} disabled={!canAdd}>
            Bæta við {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
