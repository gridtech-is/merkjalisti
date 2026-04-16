// src/components/TestingPanel.tsx
import { Button } from './ui';
import type { BaySignal, TestResult } from '../types';

interface Props {
  signals: BaySignal[];
  phase: 'FAT' | 'SAT';
  userName: string;
  onUpdate: (signalId: string, patch: Partial<BaySignal>) => void;
  onClose: () => void;
}

const RESULT_COLORS: Record<TestResult, string> = {
  PASS: 'var(--success)',
  FAIL: 'var(--danger)',
  SKIP: 'var(--muted)',
};

export function TestingPanel({ signals, phase, userName, onUpdate, onClose }: Props) {
  const testedField = phase === 'FAT' ? 'fat_tested' : 'sat_tested';
  const testedByField = phase === 'FAT' ? 'fat_tested_by' : 'sat_tested_by';
  const testedAtField = phase === 'FAT' ? 'fat_tested_at' : 'sat_tested_at';

  const tested = signals.filter(s => s[testedField]).length;
  const pct = signals.length > 0 ? Math.round((tested / signals.length) * 100) : 0;

  const markSignal = (sig: BaySignal, result: TestResult | null) => {
    if (result === null) {
      onUpdate(sig.id, {
        [testedField]: false,
        [testedByField]: null,
        [testedAtField]: null,
      });
    } else {
      onUpdate(sig.id, {
        [testedField]: result === 'PASS' || result === 'SKIP',
        [testedByField]: userName,
        [testedAtField]: new Date().toISOString(),
      });
    }
  };

  const markAll = () => {
    const now = new Date().toISOString();
    signals.forEach(sig => {
      onUpdate(sig.id, {
        [testedField]: true,
        [testedByField]: userName,
        [testedAtField]: now,
      });
    });
  };

  const cell: React.CSSProperties = {
    padding: '6px 8px',
    borderBottom: '1px solid var(--line-muted)',
    fontSize: '12px',
    verticalAlign: 'middle',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', zIndex: 200,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg)', width: '700px', display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px' }}>{phase} Prófun</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              {tested} / {signals.length} merki prófuð ({pct}%)
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <Button size="sm" variant="ghost" onClick={markAll}>Allt PASS</Button>
            <Button size="sm" variant="ghost" onClick={onClose}>Loka</Button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: '4px', background: 'var(--line)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--accent)', transition: 'width 0.2s' }} />
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-alt)' }}>
                {['Tæki', 'Merki', 'Heiti', 'Niðurstaða', 'Prófað af', ''].map(h => (
                  <th key={h} style={{ ...cell, fontWeight: 600, color: 'var(--text-secondary)', position: 'sticky', top: 0, background: 'var(--surface-alt)', zIndex: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map(sig => {
                const isTested = sig[testedField] as boolean;
                const testedBy = sig[testedByField] as string | null;
                return (
                  <tr key={sig.id} style={{ background: isTested ? 'color-mix(in srgb, var(--success) 5%, transparent)' : 'transparent' }}>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted)' }}>{sig.equipment_code}</td>
                    <td style={{ ...cell, fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent)' }}>{sig.signal_name}</td>
                    <td style={{ ...cell }}>{sig.name_is}</td>
                    <td style={{ ...cell }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {(['PASS', 'FAIL', 'SKIP'] as TestResult[]).map(r => (
                          <button key={r} type="button"
                            onClick={() => markSignal(sig, r)}
                            style={{
                              padding: '2px 8px', fontSize: '11px', fontWeight: 600,
                              border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              background: isTested ? RESULT_COLORS[r] : 'var(--surface-alt)',
                              color: isTested ? '#fff' : RESULT_COLORS[r],
                            }}>
                            {r}
                          </button>
                        ))}
                        {isTested && (
                          <button type="button" onClick={() => markSignal(sig, null)}
                            style={{ padding: '2px 6px', fontSize: '10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'transparent', color: 'var(--muted)' }}>
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ ...cell, fontSize: '11px', color: 'var(--muted)' }}>{testedBy ?? '—'}</td>
                    <td style={{ ...cell, textAlign: 'center', color: isTested ? 'var(--success)' : 'var(--muted)' }}>
                      {isTested ? '✓' : '○'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
