// src/components/ChangelogTab.tsx
import { useEffect, useState } from 'react';
import { useApi } from '../context/ApiContext';
import type { ChangeEntry, ProjectPhase } from '../types';

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

export function ChangelogTab({ projectId }: Props) {
  const { api } = useApi();
  const [entries, setEntries] = useState<ChangeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.readJson<ChangeEntry[]>(`projects/${projectId}/changelog.json`)
      .then(({ data }) => setEntries([...data].reverse()))
      .finally(() => setLoading(false));
  }, [api, projectId]);

  if (loading) return <p style={{ color: 'var(--muted)', padding: 'var(--space-4)' }}>Hleður...</p>;
  if (entries.length === 0) return <p style={{ color: 'var(--muted)', padding: 'var(--space-4)' }}>Engar breytingar skráðar.</p>;

  return (
    <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
      {entries.map(e => (
        <div key={e.id} style={{
          display: 'grid', gridTemplateColumns: '130px 80px 120px 1fr',
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
            {e.user && <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>— {e.user}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
