// src/pages/ProjectView.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { loadProject } from '../services/projectService';
import { listBays } from '../services/bayService';
import { Card, Button, Badge } from '../components/ui';
import type { Project, Equipment, Bay } from '../types';

type Tab = 'bays' | 'station' | 'overview';

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { api } = useApi();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [bays, setBays] = useState<Bay[]>([]);
  const [tab, setTab] = useState<Tab>('bays');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      loadProject(api, projectId),
      listBays(api, projectId),
    ]).then(([files, bayList]) => {
      setProject(files.project);
      setEquipment(files.equipment);
      setBays(bayList);
    }).catch(() => {
      setLoadError('Gat ekki hlaðið verkefni. Það gæti verið ófullkomið eða eytt.');
    }).finally(() => setLoading(false));
  }, [api, projectId]);

  if (loading) return <p style={{ color: 'var(--muted)' }}>Hleður...</p>;
  if (loadError || !project) return (
    <div>
      <p style={{ color: 'var(--danger)', marginBottom: 'var(--space-4)' }}>
        {loadError || 'Verkefni finnst ekki.'}
      </p>
      <Button variant="ghost" onClick={() => navigate('/')}>← Til baka</Button>
    </div>
  );

  const TABS: { id: Tab; label: string }[] = [
    { id: 'bays', label: `Reitir (${bays.length})` },
    { id: 'station', label: 'Stöðvarmerki' },
    { id: 'overview', label: 'Heildar listi' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          ← Verkefni
        </Button>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--space-6)',
      }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>{project.name}</h1>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            {equipment.length} tæki
          </div>
        </div>
        <Badge phase={project.phase}>{project.phase}</Badge>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 'var(--space-1)',
        borderBottom: '1px solid var(--line)', marginBottom: 'var(--space-6)',
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none',
              padding: '8px 16px', cursor: 'pointer',
              fontSize: '13px', fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'bays' && (
        <div>
          <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => navigate(`/projects/${projectId}/bays/new`)}>
              + Nýr reitur
            </Button>
          </div>
          {bays.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--muted)' }}>
              Engir reitir enn. Bættu við nýjum reit.
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {bays.map(bay => (
                <Card
                  key={bay.id}
                  padding="var(--space-4) var(--space-5)"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/projects/${projectId}/bays/${bay.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{bay.display_id}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {bay.signals.length} merki
                      </div>
                    </div>
                    <span style={{ color: 'var(--muted)', fontSize: '18px' }}>›</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'station' && (
        <Card style={{ color: 'var(--muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
          Stöðvarmerki — kemur í Plan 3
        </Card>
      )}

      {tab === 'overview' && (
        <Card style={{ color: 'var(--muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
          Heildar listi — kemur í Plan 3
        </Card>
      )}
    </div>
  );
}
