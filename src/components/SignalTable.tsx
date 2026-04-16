// src/components/SignalTable.tsx
import { useState } from 'react';
import { Button } from './ui';
import type { BaySignal, Equipment, SourceType } from '../types';

interface Props {
  signals: BaySignal[];
  equipment: Equipment[];
  onUpdate: (signalId: string, patch: Partial<BaySignal>) => void;
  onDelete: (signalId: string) => void;
}

const SOURCE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: 'IED', label: 'IED' },
  { value: 'HARDWIRED', label: 'Harðvíraður' },
];

const cell: React.CSSProperties = {
  padding: '5px 6px',
  borderBottom: '1px solid var(--line-muted)',
  fontSize: '12px',
  verticalAlign: 'middle',
};

const head: React.CSSProperties = {
  ...cell,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  background: 'var(--surface-alt)',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 1,
};

const eInput: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  padding: '3px 5px',
  fontSize: '11px',
  fontFamily: 'monospace',
  width: '100%',
  outline: 'none',
};

const eSelect: React.CSSProperties = {
  background: 'var(--surface-alt)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  padding: '2px 4px',
  fontSize: '11px',
  width: '100%',
  outline: 'none',
  cursor: 'pointer',
};

const onFocus = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = 'var(--accent)');
const onBlurReset = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = 'transparent');

export function SignalTable({ signals, equipment, onUpdate, onDelete }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Block edit state
  const [blockIed, setBlockIed] = useState('');
  const [blockPrefix, setBlockPrefix] = useState('');
  const [blockInst, setBlockInst] = useState('');
  const [blockRcb, setBlockRcb] = useState('');
  const [blockDse, setBlockDse] = useState('');
  const [blockEqCode, setBlockEqCode] = useState('');

  if (signals.length === 0) {
    return (
      <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
        Engin merki í þessum reit.
      </p>
    );
  }

  const allSelected = selected.size === signals.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(signals.map(s => s.id)));
  const toggle = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const applyBlock = () => {
    const ids = [...selected];
    const patch: Partial<BaySignal> = {};
    if (blockEqCode) patch.equipment_code = blockEqCode;
    if (blockIed) patch.iec61850_ied = blockIed;
    if (blockPrefix !== '') patch.iec61850_ln_prefix = blockPrefix || null;
    if (blockInst !== '') patch.iec61850_ln_inst = blockInst || null;
    if (blockRcb !== '') patch.iec61850_rcb = blockRcb || null;
    if (blockDse !== '') patch.iec61850_dataset_entry = blockDse || null;
    ids.forEach(id => onUpdate(id, patch));
    setBlockIed(''); setBlockPrefix(''); setBlockInst('');
    setBlockRcb(''); setBlockDse(''); setBlockEqCode('');
    setSelected(new Set());
  };

  const allEqCodes = equipment.map(e => e.code);
  const iedOptions = equipment; // Tech Key dropdown shows all equipment
  const blockInputStyle: React.CSSProperties = {
    background: 'var(--surface-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '4px 8px', fontSize: '12px', outline: 'none',
  };
  const blockSelectStyle: React.CSSProperties = { ...blockInputStyle, cursor: 'pointer' };

  return (
    <div>
      {/* Block edit toolbar */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)', marginBottom: 'var(--space-3)',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', minWidth: '100%' }}>
            Block edit — {selected.size} merki valin
          </div>
          {/* Tæki */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Tæki
            <select value={blockEqCode} onChange={e => setBlockEqCode(e.target.value)} style={{ ...blockSelectStyle, minWidth: '100px' }}>
              <option value="">— óbreytt —</option>
              {equipment.map(e => <option key={e.id} value={e.code}>{e.code}</option>)}
            </select>
          </label>
          {/* IED */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Tech Key
            <select value={blockIed} onChange={e => setBlockIed(e.target.value)} style={{ ...blockSelectStyle, minWidth: '130px' }}>
              <option value="">— óbreytt —</option>
              {iedOptions.map(e => <option key={e.id} value={e.code}>{e.code}</option>)}
            </select>
          </label>
          {/* LN Prefix */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            LN Prefix
            <input value={blockPrefix} onChange={e => setBlockPrefix(e.target.value)}
              placeholder="(óbreytt)" style={{ ...blockInputStyle, fontFamily: 'monospace', width: '80px' }} />
          </label>
          {/* LN Inst */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            LN Inst
            <input value={blockInst} onChange={e => setBlockInst(e.target.value)}
              placeholder="(óbreytt)" style={{ ...blockInputStyle, fontFamily: 'monospace', width: '60px' }} />
          </label>
          {/* RCB */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            RCB
            <input value={blockRcb} onChange={e => setBlockRcb(e.target.value)}
              placeholder="(óbreytt)" style={{ ...blockInputStyle, fontFamily: 'monospace', width: '140px' }} />
          </label>
          {/* Dataset Entry */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Dataset Entry
            <input value={blockDse} onChange={e => setBlockDse(e.target.value)}
              placeholder="(óbreytt)" style={{ ...blockInputStyle, fontFamily: 'monospace', width: '120px' }} />
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignSelf: 'flex-end' }}>
            <Button size="sm" onClick={applyBlock}>Nota á valin</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Hætta við</Button>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
          <thead>
            <tr>
              <th style={head}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer' }} />
              </th>
              {['#', 'Tæki', 'Merki', 'Heiti (IS)', 'Heiti (EN)', 'Alarm', 'Fl.', 'Upprunatengsl'].map(h => (
                <th key={h} style={head}>{h}</th>
              ))}
              <th colSpan={5} style={{ ...head, borderLeft: '2px solid var(--accent)', color: 'var(--accent)', textAlign: 'center' }}>
                IEC 61850 — Tilvik
              </th>
              <th colSpan={6} style={{ ...head, borderLeft: '2px solid var(--line)', textAlign: 'center' }}>
                IEC 61850 — Úr safni
              </th>
              <th style={head}>Fasi</th>
              <th style={head}></th>
            </tr>
            <tr>
              <th style={{ ...head, top: '33px' }}></th>
              {['#', 'Tæki', 'Merki', 'Heiti (IS)', 'Heiti (EN)', 'Alarm', 'Fl.', 'Upprunatengsl'].map(h => (
                <th key={`s-${h}`} style={{ ...head, top: '33px', fontSize: '10px' }}></th>
              ))}
              {(['Tech Key', 'LN Prefix', 'LN Inst', 'RCB', 'Dataset Entry'] as string[]).map((h, i) => (
                <th key={`ii-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--accent)' : undefined }}>{h}</th>
              ))}
              {(['LD', 'LN', 'DO & DA', 'FC', 'CDC', 'Dataset'] as string[]).map((h, i) => (
                <th key={`il-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--line)' : undefined }}>{h}</th>
              ))}
              <th style={{ ...head, top: '33px' }}></th>
              <th style={{ ...head, top: '33px' }}></th>
            </tr>
          </thead>
          <tbody>
            {signals.map((sig, i) => {
              const isSelected = selected.has(sig.id);
              return (
                <tr key={sig.id} style={{ background: isSelected ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                  <td style={{ ...cell, width: '32px', textAlign: 'center' }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(sig.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ ...cell, color: 'var(--muted)', width: '28px' }}>{i + 1}</td>
                  {/* Tæki dropdown */}
                  <td style={{ ...cell, minWidth: '80px' }}>
                    {allEqCodes.length > 0 ? (
                      <select value={sig.equipment_code} onChange={e => onUpdate(sig.id, { equipment_code: e.target.value })} style={eSelect}>
                        {allEqCodes.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontFamily: 'monospace', color: 'var(--accent)', fontSize: '11px' }}>{sig.equipment_code}</span>
                    )}
                  </td>
                  <td style={cell}>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{sig.signal_name}</span>
                  </td>
                  <td style={{ ...cell, minWidth: '150px' }}>
                    <input style={{ ...eInput, fontFamily: 'inherit' }} maxLength={24}
                      onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { name_is: e.target.value }); }}
                      onChange={() => {}} defaultValue={sig.name_is} key={`is-${sig.id}`} />
                  </td>
                  <td style={{ ...cell, minWidth: '130px' }}>
                    <input style={{ ...eInput, fontFamily: 'inherit' }}
                      onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { name_en: e.target.value || null }); }}
                      onChange={() => {}} defaultValue={sig.name_en ?? ''} key={`en-${sig.id}`} />
                  </td>
                  <td style={{ ...cell, textAlign: 'center' }}>
                    <input type="checkbox" checked={sig.is_alarm}
                      onChange={e => onUpdate(sig.id, { is_alarm: e.target.checked, alarm_class: e.target.checked ? (sig.alarm_class ?? 1) : null })}
                      style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ ...cell, minWidth: '90px' }}>
                    {sig.is_alarm && (
                      <select value={sig.alarm_class?.toString() ?? '1'}
                        onChange={e => onUpdate(sig.id, { alarm_class: Number(e.target.value) as 1|2|3 })} style={eSelect}>
                        {[['1','F1'],['2','F2'],['3','F3']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ ...cell, minWidth: '100px' }}>
                    <select value={sig.source_type} onChange={e => onUpdate(sig.id, { source_type: e.target.value as SourceType })} style={eSelect}>
                      {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  {/* IEC 61850 instance — IED as dropdown */}
                  <td style={{ ...cell, minWidth: '110px', borderLeft: '2px solid var(--accent)' }}>
                    {iedOptions.length > 0 ? (
                      <select value={sig.iec61850_ied ?? ''} onChange={e => onUpdate(sig.id, { iec61850_ied: e.target.value || null })} style={eSelect}>
                        <option value="">—</option>
                        {iedOptions.map(e => <option key={e.id} value={e.code}>{e.code}</option>)}
                      </select>
                    ) : (
                      <input style={eInput} defaultValue={sig.iec61850_ied ?? ''} key={`ied-${sig.id}`}
                        placeholder="Q0IED" onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { iec61850_ied: e.target.value || null }); }}
                        onChange={() => {}} />
                    )}
                  </td>
                  <td style={{ ...cell, minWidth: '65px' }}>
                    <input style={eInput} defaultValue={sig.iec61850_ln_prefix ?? ''} key={`pfx-${sig.id}`}
                      onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { iec61850_ln_prefix: e.target.value || null }); }}
                      onChange={() => {}} />
                  </td>
                  <td style={{ ...cell, minWidth: '55px' }}>
                    <input style={eInput} defaultValue={sig.iec61850_ln_inst ?? ''} key={`inst-${sig.id}`}
                      placeholder="1" onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { iec61850_ln_inst: e.target.value || null }); }}
                      onChange={() => {}} />
                  </td>
                  <td style={{ ...cell, minWidth: '110px' }}>
                    <input style={eInput} defaultValue={sig.iec61850_rcb ?? ''} key={`rcb-${sig.id}`}
                      onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { iec61850_rcb: e.target.value || null }); }}
                      onChange={() => {}} />
                  </td>
                  <td style={{ ...cell, minWidth: '110px' }}>
                    <input style={eInput} defaultValue={sig.iec61850_dataset_entry ?? ''} key={`dse-${sig.id}`}
                      onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { iec61850_dataset_entry: e.target.value || null }); }}
                      onChange={() => {}} />
                  </td>
                  {/* IEC 61850 library — read only */}
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)', borderLeft: '2px solid var(--line)' }}>{sig.iec61850_ld ?? '—'}</td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>{sig.iec61850_ln ?? '—'}</td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)', minWidth: '90px' }}>{sig.iec61850_do_da ?? '—'}</td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>{sig.iec61850_fc ?? '—'}</td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>{sig.iec61850_cdc ?? '—'}</td>
                  <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>{sig.iec61850_dataset ?? '—'}</td>
                  <td style={{ ...cell, fontSize: '10px', color: 'var(--muted)' }}>{sig.phase_added}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    <Button variant="danger" size="sm" onClick={() => onDelete(sig.id)}>Eyða</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
