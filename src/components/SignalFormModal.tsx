// src/components/SignalFormModal.tsx
import { useState } from 'react';
import { Modal, Input, Select, Button } from './ui';
import type { BaySignal, SourceType, AlarmClass, ProjectPhase } from '../types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const SOURCE_OPTIONS = [
  { value: 'IED', label: 'IED' },
  { value: 'HARDWIRED', label: 'Harðvíraður' },
];

const ALARM_CLASS_OPTIONS = [
  { value: '1', label: 'F1 – Vinnutími' },
  { value: '2', label: 'F2 – Næsti dagur' },
  { value: '3', label: 'F3 – Útkall' },
];

interface Props {
  initial?: BaySignal | null;   // null = add mode, BaySignal = edit mode
  phase: ProjectPhase;
  onSave: (signal: BaySignal) => void;
  onClose: () => void;
}

export function SignalFormModal({ initial, phase, onSave, onClose }: Props) {
  const isEdit = !!initial;
  const [equipmentCode, setEquipmentCode] = useState(initial?.equipment_code ?? '');
  const [signalName, setSignalName] = useState(initial?.signal_name ?? '');
  const [nameIs, setNameIs] = useState(initial?.name_is ?? '');
  const [nameEn, setNameEn] = useState(initial?.name_en ?? '');
  const [sourceType, setSourceType] = useState<SourceType>(initial?.source_type ?? 'IED');
  const [isAlarm, setIsAlarm] = useState(initial?.is_alarm ?? false);
  const [alarmClass, setAlarmClass] = useState<string>(initial?.alarm_class?.toString() ?? '1');
  const [iec61850Ied, setIec61850Ied] = useState(initial?.iec61850_ied ?? '');
  const [iec61850Ld, setIec61850Ld] = useState(initial?.iec61850_ld ?? '');
  const [iec61850Ln, setIec61850Ln] = useState(initial?.iec61850_ln ?? '');
  const [iec61850DoDa, setIec61850DoDa] = useState(initial?.iec61850_do_da ?? '');
  const [iec61850Fc, setIec61850Fc] = useState(initial?.iec61850_fc ?? '');
  const [iec61850Address, setIec61850Address] = useState(initial?.iec61850_address ?? '');

  const handleSave = () => {
    if (!equipmentCode.trim() || !signalName.trim() || !nameIs.trim()) return;
    const signal: BaySignal = {
      id: initial?.id ?? uuid(),
      equipment_code: equipmentCode.trim().toUpperCase(),
      signal_name: signalName.trim(),
      name_is: nameIs.trim(),
      name_en: nameEn.trim() || null,
      state_id: initial?.state_id ?? null,
      iec61850_ied: iec61850Ied.trim() || null,
      iec61850_ld: iec61850Ld.trim() || null,
      iec61850_ln: iec61850Ln.trim() || null,
      iec61850_do_da: iec61850DoDa.trim() || null,
      iec61850_fc: iec61850Fc.trim() || null,
      iec61850_address: iec61850Address.trim() || null,
      is_alarm: isAlarm,
      alarm_class: isAlarm ? (Number(alarmClass) as AlarmClass) : null,
      source_type: sourceType,
      phase_added: initial?.phase_added ?? phase,
      fat_tested: initial?.fat_tested ?? false,
      fat_tested_by: initial?.fat_tested_by ?? null,
      fat_tested_at: initial?.fat_tested_at ?? null,
      sat_tested: initial?.sat_tested ?? false,
      sat_tested_by: initial?.sat_tested_by ?? null,
      sat_tested_at: initial?.sat_tested_at ?? null,
    };
    onSave(signal);
  };

  const canSave = equipmentCode.trim() && signalName.trim() && nameIs.trim();

  return (
    <Modal title={isEdit ? 'Breyta merki' : 'Bæta við merki'} onClose={onClose} width="600px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* Basic info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Input label="Tækjakóði" value={equipmentCode} onChange={v => setEquipmentCode(v.toUpperCase())} placeholder="QA1" required />
          <Input label="Merkjanafn" value={signalName} onChange={setSignalName} placeholder="Pos.DP" required />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Input label="Heiti (IS)" value={nameIs} onChange={v => setNameIs(v.slice(0, 24))} placeholder="Staða rofa" required hint="Max 24 stafir" />
          <Input label="Heiti (EN)" value={nameEn} onChange={setNameEn} placeholder="Switch position" />
        </div>

        <Select label="Upprunatengsl" value={sourceType} onChange={v => setSourceType(v as SourceType)} options={SOURCE_OPTIONS} />

        {/* Alarm */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={isAlarm}
              onChange={e => setIsAlarm(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Er alarm
          </label>
          {isAlarm && (
            <div style={{ flex: 1 }}>
              <Select label="Alarm flokkur" value={alarmClass} onChange={setAlarmClass} options={ALARM_CLASS_OPTIONS} />
            </div>
          )}
        </div>

        {/* IEC 61850 */}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--space-4)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
            IEC 61850
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <Input label="IED" value={iec61850Ied} onChange={setIec61850Ied} placeholder="55E00BCF1" />
            <Input label="LD" value={iec61850Ld} onChange={setIec61850Ld} placeholder="PROT" />
            <Input label="LN" value={iec61850Ln} onChange={setIec61850Ln} placeholder="PTRC1" />
            <Input label="DO/DA" value={iec61850DoDa} onChange={setIec61850DoDa} placeholder="Tr" />
            <Input label="FC" value={iec61850Fc} onChange={setIec61850Fc} placeholder="ST" />
            <Input label="Heimilisfang (fullt)" value={iec61850Address} onChange={setIec61850Address} placeholder="55E00BCF1/PROT/PTRC1$ST$Tr" />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
          <Button variant="ghost" onClick={onClose}>Hætta við</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isEdit ? 'Vista breytingar' : 'Bæta við'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
