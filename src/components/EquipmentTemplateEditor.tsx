// src/components/EquipmentTemplateEditor.tsx
import { useState, useCallback } from 'react';
import { useApi } from '../context/ApiContext';
import { Button } from './ui';
import { saveEquipmentTemplate, deleteEquipmentTemplate, type EquipmentTemplateFile } from '../services/equipmentTemplateService';
import { useAutoCommit } from '../github/useAutoCommit';
import type { EquipmentTemplate, EquipmentTemplateSignal, SignalLibraryEntry } from '../types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

const cell: React.CSSProperties = { padding: '4px 6px', borderBottom: '1px solid var(--line-muted)', fontSize: '12px' };
const head: React.CSSProperties = { ...cell, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--surface-alt)', whiteSpace: 'nowrap' };
const inp: React.CSSProperties = { width: '100%', background: 'transparent', border: 'none', fontSize: '12px', color: 'var(--text)', fontFamily: 'inherit', padding: '2px 4px' };

interface Props {
  file: EquipmentTemplateFile;
  library: SignalLibraryEntry[];
  onSaved: (updated: EquipmentTemplateFile) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}

export function EquipmentTemplateEditor({ file: initialFile, library, onSaved, onDeleted, onClose }: Props) {
  const { api } = useApi();
  const [file, setFile] = useState(initialFile);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const t = file.template;

  const patch = (updates: Partial<EquipmentTemplate>) => {
    setFile(f => ({ ...f, template: { ...f.template, ...updates } }));
    setIsDirty(true);
  };

  const patchSignal = (id: string, updates: Partial<EquipmentTemplateSignal>) => {
    patch({ signals: t.signals.map(s => s.id === id ? { ...s, ...updates } : s) });
  };

  const addSignal = () => {
    patch({ signals: [...t.signals, { id: uuid(), library_id: '', signal_name: '', ld_inst: null, prefix: null, ln_class: null, ln_inst: null, do_name: null, da_name: null }] });
  };

  const removeSignal = (id: string) => {
    patch({ signals: t.signals.filter(s => s.id !== id) });
  };

  const commit = useCallback(async () => {
    if (!isDirty) return;
    setSaving(true);
    try {
      const saved = await saveEquipmentTemplate(api, file, false);
      setFile(saved);
      setIsDirty(false);
      onSaved(saved);
    } finally {
      setSaving(false);
    }
  }, [api, file, isDirty, onSaved]);

  useAutoCommit(isDirty, commit);

  const handleDelete = async () => {
    if (!confirm(`Eyða "${t.name}"? Þetta er óafturkræft.`)) return;
    await deleteEquipmentTemplate(api, t.id);
    onDeleted(t.id);
    onClose();
  };

  const libMap = new Map(library.map(e => [e.id, e]));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Breyta tækjasniðmáti</h2>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {isDirty && <Button size="sm" onClick={commit} disabled={saving}>Vista núna</Button>}
            {!isDirty && saving && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Vista...</span>}
            <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
          </div>
        </div>

        {/* Header fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          {([['name', 'Nafn'], ['manufacturer', 'Framleiðandi'], ['model', 'Líkan']] as [keyof EquipmentTemplate, string][]).map(([field, label]) => (
            <label key={field} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {label}
              <input
                style={{ display: 'block', width: '100%', marginTop: '2px', padding: '4px 8px', fontSize: '12px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
                defaultValue={(t[field] as string) ?? ''}
                onBlur={e => patch({ [field]: e.target.value || undefined })}
                onChange={() => {}}
              />
            </label>
          ))}
          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            IEC útgáfa
            <select
              style={{ display: 'block', width: '100%', marginTop: '2px', padding: '4px 8px', fontSize: '12px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)' }}
              value={t.iec61850_edition ?? '2'}
              onChange={e => patch({ iec61850_edition: e.target.value as '1' | '2' | '2.1' })}
            >
              <option value="1">Ed 1</option>
              <option value="2">Ed 2</option>
              <option value="2.1">Ed 2.1</option>
            </select>
          </label>
        </div>
        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--space-4)' }}>
          Lýsing
          <textarea
            style={{ display: 'block', width: '100%', marginTop: '2px', padding: '4px 8px', fontSize: '12px', background: 'var(--surface-alt)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', resize: 'vertical', minHeight: '48px' }}
            defaultValue={t.description ?? ''}
            onBlur={e => patch({ description: e.target.value || undefined })}
            onChange={() => {}}
          />
        </label>

        {/* Signal table */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'auto', marginBottom: 'var(--space-3)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['', 'Library merki', 'Signal name', 'LD Inst', 'Prefix', 'LN Class', 'LN Inst', 'DO Name', 'DA Name'].map(h => (
                  <th key={h} style={head}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.signals.length === 0 && (
                <tr><td colSpan={9} style={{ ...cell, textAlign: 'center', color: 'var(--muted)', padding: 'var(--space-6)' }}>Engin merki í sniðmátinu</td></tr>
              )}
              {t.signals.map((sig, i) => {
                const libEntry = libMap.get(sig.library_id);
                return (
                  <tr key={sig.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}>
                    <td style={{ ...cell, width: '28px' }}>
                      <button type="button" onClick={() => removeSignal(sig.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '14px', padding: '0 4px' }}>✕</button>
                    </td>
                    <td style={{ ...cell, minWidth: '160px' }}>
                      <select
                        style={{ ...inp, minWidth: '150px' }}
                        value={sig.library_id}
                        onChange={e => {
                          const entry = library.find(l => l.id === e.target.value);
                          patchSignal(sig.id, {
                            library_id: e.target.value,
                            signal_name: entry ? (entry.iec61850_do ? `${entry.iec61850_do}${entry.iec61850_da ? '.' + entry.iec61850_da : ''}` : sig.signal_name) : sig.signal_name,
                            ln_class: entry?.iec61850_ln ?? sig.ln_class,
                            do_name: entry?.iec61850_do ?? sig.do_name,
                            da_name: entry?.iec61850_da ?? sig.da_name,
                          });
                        }}
                      >
                        <option value="">— Veldu merki —</option>
                        {library.map(e => (
                          <option key={e.id} value={e.id}>{e.code ? `${e.code} — ` : ''}{e.name_is}</option>
                        ))}
                      </select>
                    </td>
                    <td style={cell}><input style={inp} value={sig.signal_name} onChange={e => patchSignal(sig.id, { signal_name: e.target.value })} /></td>
                    <td style={cell}><input style={inp} value={sig.ld_inst ?? ''} onChange={e => patchSignal(sig.id, { ld_inst: e.target.value || null })} /></td>
                    <td style={cell}><input style={inp} value={sig.prefix ?? ''} onChange={e => patchSignal(sig.id, { prefix: e.target.value || null })} /></td>
                    <td style={cell}><input style={inp} value={sig.ln_class ?? ''} onChange={e => patchSignal(sig.id, { ln_class: e.target.value || null })} /></td>
                    <td style={cell}><input style={inp} value={sig.ln_inst ?? ''} onChange={e => patchSignal(sig.id, { ln_inst: e.target.value || null })} /></td>
                    <td style={cell}><input style={inp} value={sig.do_name ?? ''} onChange={e => patchSignal(sig.id, { do_name: e.target.value || null })} placeholder={libEntry?.iec61850_do ?? ''} /></td>
                    <td style={cell}><input style={inp} value={sig.da_name ?? ''} onChange={e => patchSignal(sig.id, { da_name: e.target.value || null })} placeholder={libEntry?.iec61850_da ?? ''} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button size="sm" variant="ghost" onClick={addSignal}>+ Bæta við línu</Button>
          <Button size="sm" variant="danger" onClick={handleDelete}>Eyða sniðmáti</Button>
        </div>
      </div>
    </div>
  );
}
