// src/components/ImportScdModal.tsx
// Import an IEC 61850 SCD file. Offers two actions:
//   1. Add IEDs to project equipment list
//   2. Generate an Excel template pre-filled with IEC 61850 references

import { useRef, useState } from 'react';
import { Modal, Button } from './ui';
import { parseScd, scdStats, type ScdIed } from '../services/scdParser';
import { generateTemplateFromScd } from '../services/signalTemplate';
import type { Equipment } from '../types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

interface Props {
  onAddEquipment: (items: Equipment[]) => void;
  onClose: () => void;
}

export function ImportScdModal({ onAddEquipment, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ieds, setIeds] = useState<ScdIed[]>([]);
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const handleFile = (file: File) => {
    setErrors([]);
    setIeds([]);
    setSelected(new Set());
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseScd(text);
      setIeds(result.ieds);
      setErrors(result.errors);
      setFileName(file.name);
      // Select all IEDs by default
      setSelected(new Set(result.ieds.map(i => i.name)));
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const toggleIed = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleExpand = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const selectedIeds = ieds.filter(i => selected.has(i.name));
  const stats = scdStats(selectedIeds);

  const handleAddEquipment = () => {
    const items: Equipment[] = selectedIeds.map(ied => ({
      id: uuid(),
      category: 'ied' as const,
      code: ied.name,              // IED name used as tech key by default
      type: null,
      ied_name: ied.name,
      manufacturer: ied.manufacturer || null,
      model: ied.model || null,
      template_id: null,
      description: ied.desc || '',
    }));
    onAddEquipment(items);
  };

  const handleExcel = () => {
    generateTemplateFromScd(selectedIeds, fileName);
  };

  return (
    <Modal title="Innflutningur IEC 61850 SCD skráar" onClose={onClose} width="680px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* Drop zone */}
        {ieds.length === 0 && errors.length === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            style={{
              border: '2px dashed var(--line)',
              borderRadius: 'var(--radius)',
              padding: 'var(--space-8)',
              textAlign: 'center',
              cursor: 'pointer',
              color: 'var(--muted)',
              fontSize: '13px',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line)')}
          >
            <div style={{ fontSize: '28px', marginBottom: 'var(--space-2)' }}>📄</div>
            <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text)' }}>
              Dragðu .scd / .xml skrá hingað
            </div>
            <div>eða smelltu til að velja skrá</div>
            <input
              ref={inputRef}
              type="file"
              accept=".scd,.xml"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div style={{ fontSize: '13px', color: 'var(--danger)', padding: 'var(--space-3)', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', borderRadius: 'var(--radius-sm)' }}>
            {errors.map((e, i) => <div key={i}>{e}</div>)}
            <button type="button" onClick={() => { setErrors([]); setIeds([]); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', marginTop: '4px', padding: 0 }}>
              Reyna aftur
            </button>
          </div>
        )}

        {/* File loaded — summary + IED list */}
        {ieds.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', fontSize: '12px' }}>
              <span style={{ color: 'var(--muted)' }}>{fileName}</span>
              <span style={{ color: 'var(--success)' }}>✓ {ieds.length} IED</span>
              <button
                type="button"
                onClick={() => { setIeds([]); setErrors([]); setFileName(''); setSelected(new Set()); }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', marginLeft: 'auto', padding: 0 }}
              >Velja aðra skrá</button>
            </div>

            {/* IED list */}
            <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', overflow: 'hidden', maxHeight: '360px', overflowY: 'auto' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 100px 80px 80px 80px', gap: '8px', padding: '6px 10px', background: 'var(--surface-alt)', borderBottom: '1px solid var(--line)', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <div></div>
                <div>IED nafn</div>
                <div>Framleiðandi</div>
                <div>Líkan</div>
                <div>LD</div>
                <div>LN</div>
              </div>

              {ieds.map(ied => {
                const lnCount = ied.lds.reduce((s, ld) => s + ld.lns.length, 0);
                const isSelected = selected.has(ied.name);
                const isExpanded = expanded.has(ied.name);
                return (
                  <div key={ied.name}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '32px 1fr 100px 80px 80px 80px',
                        gap: '8px',
                        padding: '6px 10px',
                        borderBottom: '1px solid var(--line-muted)',
                        fontSize: '12px',
                        background: isSelected ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                        alignItems: 'center',
                      }}
                    >
                      <input type="checkbox" checked={isSelected} onChange={() => toggleIed(ied.name)} style={{ cursor: 'pointer' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)' }}>{ied.name}</span>
                        {ied.desc && <span style={{ color: 'var(--muted)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ied.desc}</span>}
                        {ied.lds.length > 0 && (
                          <button type="button" onClick={() => toggleExpand(ied.name)}
                            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '10px', padding: '0 4px' }}>
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        )}
                      </div>
                      <span style={{ color: 'var(--muted)', fontSize: '11px' }}>{ied.manufacturer}</span>
                      <span style={{ color: 'var(--muted)', fontSize: '11px', fontFamily: 'monospace' }}>{ied.model}</span>
                      <span style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>{ied.lds.length}</span>
                      <span style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>{lnCount}</span>
                    </div>

                    {/* Expanded LD/LN view */}
                    {isExpanded && ied.lds.map(ld => (
                      <div key={ld.inst} style={{ paddingLeft: '48px', borderBottom: '1px solid var(--line-muted)', background: 'var(--surface-alt)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', padding: '4px 8px' }}>
                          LD: <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{ied.name}/{ld.inst}</span>
                        </div>
                        {ld.lns.map((ln, i) => (
                          <div key={i} style={{ fontSize: '11px', color: 'var(--muted)', padding: '2px 8px', fontFamily: 'monospace' }}>
                            {ln.prefix}{ln.lnClass}{ln.inst}
                            {ln.doDas.length > 0 && <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', fontFamily: 'inherit', fontSize: '10px' }}>({ln.doDas.length} DO/DA)</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Selection summary */}
            <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', gap: 'var(--space-4)' }}>
              <span>{selected.size}/{ieds.length} IED valin</span>
              {stats.doDaCount > 0
                ? <span>→ {stats.lnCount} LN · {stats.doDaCount} DO/DA færslur í sniðmáti</span>
                : <span>→ {stats.lnCount} LN færslur í sniðmáti</span>
              }
            </div>
          </>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', borderTop: ieds.length > 0 ? '1px solid var(--line)' : 'none', paddingTop: ieds.length > 0 ? 'var(--space-4)' : 0 }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {ieds.length > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={selected.size === 0}
                  onClick={handleAddEquipment}
                >
                  + Bæta IED-um við tæki
                </Button>
                <Button
                  size="sm"
                  disabled={selected.size === 0}
                  onClick={handleExcel}
                >
                  ↓ Búa til Excel sniðmát
                </Button>
              </>
            )}
          </div>
          <Button variant="ghost" onClick={onClose}>Loka</Button>
        </div>
      </div>
    </Modal>
  );
}
