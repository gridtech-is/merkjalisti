// src/components/SignalTable.tsx
import { Button } from './ui';
import type { BaySignal, SourceType } from '../types';

interface Props {
  signals: BaySignal[];
  onUpdate: (signalId: string, patch: Partial<BaySignal>) => void;
  onDelete: (signalId: string) => void;
  onEdit: (signal: BaySignal) => void;
}

const SOURCE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: 'IED', label: 'IED' },
  { value: 'HARDWIRED', label: 'Harðvíraður' },
];

const ALARM_CLASS_OPTIONS = [
  { value: '', label: '—' },
  { value: '1', label: 'F1 – Vinnutími' },
  { value: '2', label: 'F2 – Næsti dagur' },
  { value: '3', label: 'F3 – Útkall' },
];

const cellStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--line-muted)',
  fontSize: '12px',
  verticalAlign: 'middle',
};

const headerStyle: React.CSSProperties = {
  ...cellStyle,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  background: 'var(--surface-alt)',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 1,
};

const editableInput: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  padding: '3px 6px',
  fontSize: '12px',
  fontFamily: 'inherit',
  width: '100%',
  outline: 'none',
};

export function SignalTable({ signals, onUpdate, onDelete, onEdit }: Props) {
  if (signals.length === 0) {
    return (
      <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
        Engin merki í þessum reit.
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
        <thead>
          <tr>
            {['#', 'Tæki', 'Merki', 'Heiti (IS)', 'Heiti (EN)', 'Alarm', 'Fl.', 'Upprunatengsl', 'IEC 61850 address', 'Fasi', 'Aðgerðir'].map(h => (
              <th key={h} style={headerStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {signals.map((sig, i) => (
            <tr
              key={sig.id}
              style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}
            >
              <td style={{ ...cellStyle, color: 'var(--muted)', width: '32px' }}>{i + 1}</td>
              <td style={cellStyle}>
                <span style={{ fontFamily: 'monospace', color: 'var(--accent)', fontSize: '11px' }}>
                  {sig.equipment_code}
                </span>
              </td>
              <td style={cellStyle}>
                <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                  {sig.signal_name}
                </span>
              </td>
              <td style={{ ...cellStyle, minWidth: '160px' }}>
                <input
                  style={editableInput}
                  maxLength={24}
                  title="Max 24 stafir"
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => {
                    e.target.style.borderColor = 'transparent';
                    onUpdate(sig.id, { name_is: e.target.value });
                  }}
                  onChange={() => {}}
                  defaultValue={sig.name_is}
                  key={`is-${sig.id}`}
                />
              </td>
              <td style={{ ...cellStyle, minWidth: '140px' }}>
                <input
                  style={editableInput}
                  defaultValue={sig.name_en ?? ''}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => {
                    e.target.style.borderColor = 'transparent';
                    onUpdate(sig.id, { name_en: e.target.value || null });
                  }}
                  onChange={() => {}}
                  key={`en-${sig.id}`}
                />
              </td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={sig.is_alarm}
                  onChange={e => onUpdate(sig.id, {
                    is_alarm: e.target.checked,
                    alarm_class: e.target.checked ? (sig.alarm_class ?? 1) : null,
                  })}
                  style={{ cursor: 'pointer' }}
                />
              </td>
              <td style={{ ...cellStyle, minWidth: '100px' }}>
                {sig.is_alarm && (
                  <select
                    value={sig.alarm_class?.toString() ?? '1'}
                    onChange={e => onUpdate(sig.id, { alarm_class: Number(e.target.value) as 1|2|3 })}
                    style={{
                      background: 'var(--surface-alt)', border: '1px solid var(--line)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                      padding: '2px 4px', fontSize: '11px', width: '100%',
                    }}
                  >
                    {ALARM_CLASS_OPTIONS.filter(o => o.value !== '').map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}
              </td>
              <td style={{ ...cellStyle, minWidth: '100px' }}>
                <select
                  value={sig.source_type}
                  onChange={e => onUpdate(sig.id, { source_type: e.target.value as SourceType })}
                  style={{
                    background: 'var(--surface-alt)', border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                    padding: '2px 4px', fontSize: '11px', width: '100%',
                  }}
                >
                  {SOURCE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </td>
              <td style={{ ...cellStyle, minWidth: '220px' }}>
                <input
                  style={{ ...editableInput, fontFamily: 'monospace', fontSize: '11px' }}
                  defaultValue={sig.iec61850_address ?? ''}
                  placeholder="IED/LD/LN$FC$DO"
                  onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => {
                    e.target.style.borderColor = 'transparent';
                    onUpdate(sig.id, { iec61850_address: e.target.value || null });
                  }}
                  onChange={() => {}}
                  key={`addr-${sig.id}`}
                />
              </td>
              <td style={{ ...cellStyle, fontSize: '10px', color: 'var(--muted)' }}>
                {sig.phase_added}
              </td>
              <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                <Button variant="ghost" size="sm" onClick={() => onEdit(sig)}>Breyta</Button>
                {' '}
                <Button variant="danger" size="sm" onClick={() => onDelete(sig.id)}>Eyða</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
