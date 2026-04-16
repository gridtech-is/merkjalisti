// src/components/SignalTable.tsx
import { Button } from './ui';
import type { BaySignal, SourceType } from '../types';

interface Props {
  signals: BaySignal[];
  onUpdate: (signalId: string, patch: Partial<BaySignal>) => void;
  onDelete: (signalId: string) => void;
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

export function SignalTable({ signals, onUpdate, onDelete }: Props) {
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
            {['#', 'Tæki', 'Merki', 'Heiti (IS)', 'Heiti (EN)', 'Alarm', 'Fl.', 'Upprunatengsl'].map(h => (
              <th key={h} style={headerStyle}>{h}</th>
            ))}
            <th colSpan={5} style={{ ...headerStyle, borderLeft: '2px solid var(--accent)', color: 'var(--accent)', textAlign: 'center' }}>
              IEC 61850 — Tilvik
            </th>
            <th colSpan={6} style={{ ...headerStyle, borderLeft: '2px solid var(--line)', color: 'var(--text-secondary)', textAlign: 'center' }}>
              IEC 61850 — Úr safni
            </th>
            <th style={headerStyle}>Fasi</th>
            <th style={headerStyle}></th>
          </tr>
          <tr>
            {['#', 'Tæki', 'Merki', 'Heiti (IS)', 'Heiti (EN)', 'Alarm', 'Fl.', 'Upprunatengsl'].map(h => (
              <th key={`s-${h}`} style={{ ...headerStyle, top: '33px', fontSize: '10px' }}></th>
            ))}
            {[['IED / Tech Key', true], ['LN Prefix', true], ['LN Inst', true], ['RCB', true], ['Dataset Entry', true]].map(([h, _]) => (
              <th key={`iec-i-${h}`} style={{ ...headerStyle, top: '33px', fontSize: '10px', borderLeft: h === 'IED / Tech Key' ? '2px solid var(--accent)' : undefined }}>{h as string}</th>
            ))}
            {[['LD', false], ['LN', false], ['DO & DA', false], ['FC', false], ['CDC', false], ['Dataset', false]].map(([h, _]) => (
              <th key={`iec-l-${h}`} style={{ ...headerStyle, top: '33px', fontSize: '10px', borderLeft: h === 'LD' ? '2px solid var(--line)' : undefined }}>{h as string}</th>
            ))}
            <th style={{ ...headerStyle, top: '33px', fontSize: '10px' }}></th>
            <th style={{ ...headerStyle, top: '33px', fontSize: '10px' }}></th>
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
              {/* IEC 61850 — per instance (editable) */}
              <td style={{ ...cellStyle, minWidth: '90px', borderLeft: '2px solid var(--accent)' }}>
                <input style={{ ...editableInput, fontFamily: 'monospace', fontSize: '11px' }}
                  defaultValue={sig.iec61850_ied ?? ''} key={`ied-${sig.id}`}
                  placeholder="Q0" onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => { e.target.style.borderColor = 'transparent'; onUpdate(sig.id, { iec61850_ied: e.target.value || null }); }}
                  onChange={() => {}} />
              </td>
              <td style={{ ...cellStyle, minWidth: '70px' }}>
                <input style={{ ...editableInput, fontFamily: 'monospace', fontSize: '11px' }}
                  defaultValue={sig.iec61850_ln_prefix ?? ''} key={`pfx-${sig.id}`}
                  placeholder="" onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => { e.target.style.borderColor = 'transparent'; onUpdate(sig.id, { iec61850_ln_prefix: e.target.value || null }); }}
                  onChange={() => {}} />
              </td>
              <td style={{ ...cellStyle, minWidth: '60px' }}>
                <input style={{ ...editableInput, fontFamily: 'monospace', fontSize: '11px' }}
                  defaultValue={sig.iec61850_ln_inst ?? ''} key={`inst-${sig.id}`}
                  placeholder="1" onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => { e.target.style.borderColor = 'transparent'; onUpdate(sig.id, { iec61850_ln_inst: e.target.value || null }); }}
                  onChange={() => {}} />
              </td>
              <td style={{ ...cellStyle, minWidth: '110px' }}>
                <input style={{ ...editableInput, fontFamily: 'monospace', fontSize: '11px' }}
                  defaultValue={sig.iec61850_rcb ?? ''} key={`rcb-${sig.id}`}
                  placeholder="BR$brcbProt01" onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => { e.target.style.borderColor = 'transparent'; onUpdate(sig.id, { iec61850_rcb: e.target.value || null }); }}
                  onChange={() => {}} />
              </td>
              <td style={{ ...cellStyle, minWidth: '120px' }}>
                <input style={{ ...editableInput, fontFamily: 'monospace', fontSize: '11px' }}
                  defaultValue={sig.iec61850_dataset_entry ?? ''} key={`dse-${sig.id}`}
                  placeholder="" onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={e => { e.target.style.borderColor = 'transparent'; onUpdate(sig.id, { iec61850_dataset_entry: e.target.value || null }); }}
                  onChange={() => {}} />
              </td>
              {/* IEC 61850 — from library (display only) */}
              <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)', borderLeft: '2px solid var(--line)' }}>
                {sig.iec61850_ld ?? '—'}
              </td>
              <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>
                {sig.iec61850_ln ?? '—'}
              </td>
              <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)', minWidth: '100px' }}>
                {sig.iec61850_do_da ?? '—'}
              </td>
              <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>
                {sig.iec61850_fc ?? '—'}
              </td>
              <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>
                {sig.iec61850_cdc ?? '—'}
              </td>
              <td style={{ ...cellStyle, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>
                {sig.iec61850_dataset ?? '—'}
              </td>
              <td style={{ ...cellStyle, fontSize: '10px', color: 'var(--muted)' }}>
                {sig.phase_added}
              </td>
              <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                <Button variant="danger" size="sm" onClick={() => onDelete(sig.id)}>Eyða</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
