// src/components/ChangelogTab.tsx
import { useEffect, useState } from 'react';
import { useApi } from '../context/ApiContext';
import type { ChangeEntry, ProjectPhase } from '../types';
import { loadBay, saveBay } from '../services/bayService';

const TYPE_LABELS: Record<string, string> = {
  SIGNAL_ADDED: 'Merki bætt við',
  SIGNAL_REMOVED: 'Merki eytt',
  FIELD_CHANGED: 'Reitur breyttur',
  PHASE_CHANGED: 'Fasi breyttur',
  REVIEW_ADDED: 'Yfirferð',
  FAT_TESTED: 'FAT prófað',
  SAT_TESTED: 'SAT prófað',
};

const PHASE_COLORS: Partial<Record<ProjectPhase, string>> = {
  DESIGN: 'var(--accent)', FROZEN: 'var(--text-secondary)',
  REVIEW: 'var(--warn)', FAT: '#8b5cf6', SAT: 'var(--success)',
};

interface Props {
  projectId: string;
}

function parseFieldValue(field: string, value: string): unknown {
  const boolFields = ['is_alarm', 'fat_tested', 'sat_tested', 'review_flagged', 'hmi_event', 'to_control_room'];
  if (boolFields.includes(field)) return value === 'true';
  if (field === 'alarm_class') {
    const n = Number(value);
    return isNaN(n) ? null : n;
  }
  return value || null;
}

export function ChangelogTab({ projectId }: Props) {
  const { api } = useApi();
  const [entries, setEntries] = useState<ChangeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<string | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);

  useEffect(() => {
    api.readJson<ChangeEntry[]>(`projects/${projectId}/changelog.json`)
      .then(({ data }) => setEntries([...data].reverse()))
      .finally(() => setLoading(false));
  }, [api, projectId]);

  const handleRevert = async (entry: ChangeEntry) => {
    if (!entry.target_parent_id || !entry.field || entry.old_value === null) return;
    setReverting(entry.id);
    setRevertError(null);
    try {
      const { bay, sha } = await loadBay(api, projectId, entry.target_parent_id);
      const updatedSignals = bay.signals.map(s =>
        s.id === entry.target_id
          ? { ...s, [entry.field!]: parseFieldValue(entry.field!, entry.old_value!) }
          : s
      );
      await saveBay(api, projectId, { bay: { ...bay, signals: updatedSignals }, sha }, 'DESIGN');
      const { data } = await api.readJson<ChangeEntry[]>(`projects/${projectId}/changelog.json`);
      setEntries([...data].reverse());
    } catch {
      setRevertError('Tókst ekki að afturkalla breytinguna.');
    } finally {
      setReverting(null);
    }
  };

  if (loading) return <p style={{ color: 'var(--muted)', padding: 'var(--space-4)' }}>Hleður...</p>;
  if (entries.length === 0) return <p style={{ color: 'var(--muted)', padding: 'var(--space-4)' }}>Engar breytingar skráðar.</p>;

  return (
    <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
      {revertError && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-3)',
          background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
          border: '1px solid var(--danger)', borderRadius: 'var(--radius)',
          fontSize: '12px', color: 'var(--danger)',
        }}>
          {revertError}
          <button
            type="button"
            onClick={() => setRevertError(null)}
            style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontWeight: 600 }}
          >
            ✕
          </button>
        </div>
      )}
      {entries.map(e => {
        const canRevert =
          e.type === 'FIELD_CHANGED' &&
          !!e.target_parent_id &&
          e.old_value !== null &&
          !!e.field;

        return (
          <div key={e.id} style={{
            display: 'grid',
            gridTemplateColumns: '130px 80px 120px 1fr auto',
            gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--line-muted)', fontSize: '12px', alignItems: 'start',
          }}>
            <span style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: '11px' }}>
              {new Date(e.timestamp).toLocaleString('is-IS')}
            </span>
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: 'var(--radius-sm)',
              background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
              color: PHASE_COLORS[e.phase] ?? 'var(--accent)',
            }}>
              {e.phase}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>{TYPE_LABELS[e.type] ?? e.type}</span>
            <span style={{ color: 'var(--text)' }}>
              {e.comment}
              {e.field && e.old_value !== null && (
                <span style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: '11px', marginLeft: '6px' }}>
                  {e.old_value} → {e.new_value ?? '∅'}
                </span>
              )}
              {e.user && <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>— {e.user}</span>}
            </span>
            <span>
              {canRevert && (
                <button
                  type="button"
                  onClick={() => handleRevert(e)}
                  disabled={reverting === e.id}
                  style={{
                    fontSize: '11px', padding: '2px 8px', cursor: 'pointer',
                    background: 'var(--surface-alt)', border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
                    opacity: reverting === e.id ? 0.5 : 1,
                  }}
                >
                  {reverting === e.id ? '...' : '↩ Afturkalla'}
                </button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
