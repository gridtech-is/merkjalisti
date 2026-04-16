// src/components/SignalTable.tsx
import { useState } from 'react';
import { Button } from './ui';
import type { BaySignal, Equipment, SignalLibraryEntry, SignalState, StateAlarmMap, AlarmClass, SourceType } from '../types';

interface Props {
  signals: BaySignal[];
  equipment: Equipment[];
  library?: SignalLibraryEntry[];
  states?: SignalState[];
  bayDisplayId?: string;
  reviewMode?: boolean;
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

export function SignalTable({ signals, equipment, library = [], states = [], bayDisplayId = '', reviewMode = false, onUpdate, onDelete }: Props) {
  // Build lookup index: code → library entry
  const libraryIndex = new Map(library.filter(e => e.code).map(e => [e.code!, e]));
  // Build state index: id → SignalState
  const stateIndex = new Map(states.map(s => [s.id, s]));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stateLang, setStateLang] = useState<'is' | 'en'>('is');
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [flagComment, setFlagComment] = useState('');
  const [popupId, setPopupId] = useState<string | null>(null);
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

      {/* IS/EN toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 'var(--space-2)' }}>
        <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
          {(['is', 'en'] as const).map(lang => (
            <button key={lang} type="button" onClick={() => setStateLang(lang)}
              style={{ padding: '2px 10px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                background: stateLang === lang ? 'var(--accent)' : 'transparent',
                color: stateLang === lang ? '#fff' : 'var(--text-secondary)' }}>
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
          <thead>
            <tr>
              <th style={head}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer' }} />
              </th>
              {['#', 'Tæki', 'Merki', 'Kóði', 'Texti'].map(h => (
                <th key={h} style={head}>{h}</th>
              ))}
              <th colSpan={2} style={{ ...head, borderLeft: '2px solid var(--line)', textAlign: 'center' }}>Stöður</th>
              {['Alarm', 'Fl.', 'Upprunatengsl'].map(h => (
                <th key={h} style={head}>{h}</th>
              ))}
              <th colSpan={5} style={{ ...head, borderLeft: '2px solid var(--accent)', color: 'var(--accent)', textAlign: 'center' }}>
                IEC 61850 — Tilvik
              </th>
              <th colSpan={6} style={{ ...head, borderLeft: '2px solid var(--line)', textAlign: 'center' }}>
                IEC 61850 — Úr safni
              </th>
              <th style={head}>Fasi</th>
              {reviewMode && <th style={head}></th>}
              <th style={head}></th>
            </tr>
            <tr>
              <th style={{ ...head, top: '33px' }}></th>
              {['#', 'Tæki', 'Merki', 'Kóði', 'Texti'].map(h => (
                <th key={`s-${h}`} style={{ ...head, top: '33px', fontSize: '10px' }}></th>
              ))}
              {(['Staða', 'Tegund'] as string[]).map((h, i) => (
                <th key={`st2-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--line)' : undefined }}>{h}</th>
              ))}
              {['Alarm', 'Fl.', 'Upprunatengsl'].map(h => (
                <th key={`s-${h}`} style={{ ...head, top: '33px', fontSize: '10px' }}></th>
              ))}
              {(['Tech Key', 'LN Prefix', 'LN Inst', 'RCB', 'Dataset Entry'] as string[]).map((h, i) => (
                <th key={`ii-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--accent)' : undefined }}>{h}</th>
              ))}
              {(['LD', 'LN', 'DO & DA', 'FC', 'CDC', 'Dataset'] as string[]).map((h, i) => (
                <th key={`il-${h}`} style={{ ...head, top: '33px', fontSize: '10px', borderLeft: i === 0 ? '2px solid var(--line)' : undefined }}>{h}</th>
              ))}
              <th style={{ ...head, top: '33px' }}></th>
              {reviewMode && <th style={{ ...head, top: '33px' }}></th>}
              <th style={{ ...head, top: '33px' }}></th>
            </tr>
          </thead>
          <tbody>
            {signals.map((sig, i) => {
              const isSelected = selected.has(sig.id);
              return (
                <tr key={sig.id} style={{ background: sig.review_flagged ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : isSelected ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
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
                  <td style={{ ...cell, minWidth: '120px' }}>
                    <input
                      style={{ ...eInput, color: 'var(--accent)' }}
                      defaultValue={sig.signal_name}
                      key={`sn-${sig.id}-${sig.signal_name}`}
                      list={`lib-${sig.id}`}
                      placeholder="kóði"
                      onFocus={onFocus}
                      onBlur={e => {
                        onBlurReset(e);
                        const newCode = e.target.value.trim();
                        if (newCode === sig.signal_name) return;
                        const entry = libraryIndex.get(newCode);
                        if (entry) {
                          onUpdate(sig.id, {
                            signal_name: newCode,
                            library_id: entry.id,
                            name_is: entry.name_is,
                            name_en: entry.name_en ?? null,
                            is_alarm: entry.is_alarm,
                            alarm_class: entry.alarm_class ?? null,
                            source_type: entry.source_type,
                            state_id: entry.state_id ?? null,
                            iec61850_ld: entry.iec61850_ld ?? null,
                            iec61850_ln: entry.iec61850_ln ?? null,
                            iec61850_do_da: entry.iec61850_do_da ?? null,
                            iec61850_fc: entry.iec61850_fc ?? null,
                            iec61850_cdc: entry.iec61850_cdc ?? null,
                            iec61850_dataset: entry.iec61850_dataset ?? null,
                          });
                        } else {
                          onUpdate(sig.id, { signal_name: newCode });
                        }
                      }}
                      onChange={() => {}}
                    />
                    {library.length > 0 && (
                      <datalist id={`lib-${sig.id}`}>
                        {library.filter(e => e.code).map(e => (
                          <option key={e.code!} value={e.code!}>{e.name_is}</option>
                        ))}
                      </datalist>
                    )}
                  </td>
                  {/* Kóði — computed identifier */}
                  <td style={{ ...cell, minWidth: '160px' }}>
                    {(() => {
                      const code = [bayDisplayId, sig.equipment_code, sig.signal_name].filter(Boolean).join('_');
                      return (
                        <span
                          title="Smelltu til að afrita"
                          onClick={() => navigator.clipboard?.writeText(code)}
                          style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'copy', whiteSpace: 'nowrap' }}
                        >{code}</span>
                      );
                    })()}
                  </td>
                  <td style={{ ...cell, minWidth: '150px' }}>
                    {stateLang === 'is' ? (
                      <input style={{ ...eInput, fontFamily: 'inherit' }}
                        onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { name_is: e.target.value }); }}
                        onChange={() => {}} defaultValue={sig.name_is} key={`is-${sig.id}-${sig.name_is}`} />
                    ) : (
                      <input style={{ ...eInput, fontFamily: 'inherit' }}
                        onFocus={onFocus} onBlur={e => { onBlurReset(e); onUpdate(sig.id, { name_en: e.target.value || null }); }}
                        onChange={() => {}} defaultValue={sig.name_en ?? ''} key={`en-${sig.id}-${sig.name_en}`} />
                    )}
                  </td>
                  {/* Stöður — texti only */}
                  {(() => {
                    const st = sig.state_id ? stateIndex.get(sig.state_id) : undefined;
                    const ORDER = ['00', '01', '10', '11'] as const;
                    const stateRows = st
                      ? ORDER.map(k => {
                          const stEntry = st.states[k];
                          if (!stEntry) return null;
                          const text = stateLang === 'is' ? stEntry.is : stEntry.en;
                          return { k, text: text ?? k };
                        }).filter(Boolean)
                      : [];
                    return (
                      <>
                        <td style={{ ...cell, borderLeft: '2px solid var(--line)', minWidth: '180px', verticalAlign: 'top', padding: '4px 6px' }}>
                          {stateRows.length > 0 ? stateRows.map(row => {
                            if (!row) return null;
                            return (
                              <div key={row.k} style={{ display: 'flex', gap: '6px', marginBottom: '2px', fontSize: '11px' }}>
                                <span style={{ fontFamily: 'monospace', color: 'var(--muted)', minWidth: '22px' }}>{row.k}</span>
                                <span style={{ color: 'var(--text-secondary)' }}>{row.text}</span>
                              </div>
                            );
                          }) : <span style={{ color: 'var(--muted)', fontSize: '11px' }}>—</span>}
                        </td>
                        <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>{st?.type ?? '—'}</td>
                      </>
                    );
                  })()}
                  {/* Alarm — per-state checkboxes */}
                  {(() => {
                    const st = sig.state_id ? stateIndex.get(sig.state_id) : undefined;
                    const ORDER = ['00', '01', '10', '11'] as const;
                    const map: StateAlarmMap = sig.state_alarm_map ?? {};

                    const updateStateMap = (key: '00'|'01'|'10'|'11', isAlarm: boolean) => {
                      const current = map[key] ?? { is_alarm: false, is_event: false, alarm_class: null };
                      const updated: StateAlarmMap = { ...map, [key]: { ...current, is_alarm: isAlarm, alarm_class: isAlarm ? (current.alarm_class ?? 1) : null } };
                      onUpdate(sig.id, { state_alarm_map: updated });
                    };

                    const updateAlarmClass = (key: '00'|'01'|'10'|'11', cls: AlarmClass) => {
                      const current = map[key] ?? { is_alarm: false, is_event: false, alarm_class: null };
                      const updated: StateAlarmMap = { ...map, [key]: { ...current, alarm_class: cls } };
                      onUpdate(sig.id, { state_alarm_map: updated });
                    };

                    if (!st) {
                      // No state — simple alarm checkbox
                      return (
                        <>
                          <td style={{ ...cell, textAlign: 'center' }}>
                            <input type="checkbox" checked={sig.is_alarm}
                              onChange={e => onUpdate(sig.id, { is_alarm: e.target.checked, alarm_class: e.target.checked ? (sig.alarm_class ?? 1) : null })}
                              style={{ cursor: 'pointer' }} />
                          </td>
                          <td style={{ ...cell, minWidth: '60px' }}>
                            {sig.is_alarm && (
                              <select value={sig.alarm_class?.toString() ?? '1'}
                                onChange={e => onUpdate(sig.id, { alarm_class: Number(e.target.value) as 1|2|3 })} style={eSelect}>
                                {[['1','F1'],['2','F2'],['3','F3']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                              </select>
                            )}
                          </td>
                        </>
                      );
                    }

                    const alarmRows = ORDER.map(k => {
                      const stEntry = st.states[k];
                      if (!stEntry) return null;
                      const cfg = map[k] ?? { is_alarm: false, is_event: false, alarm_class: null };
                      return { k, cfg };
                    }).filter(Boolean);

                    return (
                      <>
                        <td style={{ ...cell, verticalAlign: 'top', padding: '4px 6px' }}>
                          {alarmRows.map(row => {
                            if (!row) return null;
                            const { k, cfg } = row;
                            return (
                              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', height: '18px' }}>
                                <span style={{ fontFamily: 'monospace', color: 'var(--muted)', fontSize: '10px', minWidth: '22px' }}>{k}</span>
                                <input type="checkbox" checked={cfg.is_alarm}
                                  onChange={e => updateStateMap(k as '00'|'01'|'10'|'11', e.target.checked)}
                                  style={{ cursor: 'pointer', accentColor: 'var(--danger)' }} />
                              </div>
                            );
                          })}
                        </td>
                        <td style={{ ...cell, verticalAlign: 'top', padding: '4px 6px', minWidth: '55px' }}>
                          {alarmRows.map(row => {
                            if (!row) return null;
                            const { k, cfg } = row;
                            return (
                              <div key={k} style={{ height: '18px', marginBottom: '2px', display: 'flex', alignItems: 'center' }}>
                                {cfg.is_alarm ? (
                                  <select value={cfg.alarm_class?.toString() ?? '1'}
                                    onChange={e => updateAlarmClass(k as '00'|'01'|'10'|'11', Number(e.target.value) as AlarmClass)}
                                    style={{ ...eSelect, width: '44px', padding: '1px 2px', fontSize: '10px' }}>
                                    {[['1','F1'],['2','F2'],['3','F3']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                                  </select>
                                ) : <span style={{ color: 'var(--muted)', fontSize: '10px' }}>—</span>}
                              </div>
                            );
                          })}
                        </td>
                      </>
                    );
                  })()}
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
                  {reviewMode && (
                    <td style={{ ...cell, width: '80px', position: 'relative' }}>
                      {sig.review_flagged ? (
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={() => setPopupId(popupId === sig.id ? null : sig.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}
                            title={sig.review_comment ?? ''}
                          >
                            💬
                          </button>
                          {popupId === sig.id && (
                            <div style={{
                              position: 'absolute', right: 0, top: '100%', zIndex: 10,
                              background: 'var(--surface)', border: '1px solid var(--line)',
                              borderRadius: 'var(--radius)', padding: 'var(--space-3)',
                              minWidth: '200px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                              fontSize: '12px',
                            }}>
                              <div style={{ color: 'var(--text)', marginBottom: 'var(--space-2)' }}>{sig.review_comment}</div>
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdate(sig.id, { review_flagged: false, review_comment: null });
                                  setPopupId(null);
                                }}
                                style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', cursor: 'pointer' }}
                              >
                                Hreinsa
                              </button>
                            </div>
                          )}
                        </div>
                      ) : flaggingId === sig.id ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input
                            autoFocus
                            value={flagComment}
                            onChange={e => setFlagComment(e.target.value)}
                            placeholder="Athugasemd..."
                            style={{ ...eInput, border: '1px solid var(--accent)', width: '120px' }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && flagComment.trim()) {
                                onUpdate(sig.id, { review_flagged: true, review_comment: flagComment.trim() });
                                setFlaggingId(null);
                                setFlagComment('');
                              }
                              if (e.key === 'Escape') { setFlaggingId(null); setFlagComment(''); }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (flagComment.trim()) {
                                onUpdate(sig.id, { review_flagged: true, review_comment: flagComment.trim() });
                              }
                              setFlaggingId(null);
                              setFlagComment('');
                            }}
                            style={{ fontSize: '11px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '2px 6px', cursor: 'pointer' }}
                          >✓</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setFlaggingId(sig.id); setFlagComment(''); }}
                          style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', cursor: 'pointer' }}
                        >
                          💬
                        </button>
                      )}
                    </td>
                  )}
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
