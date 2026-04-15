// src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { listProjects } from '../services/projectService';
import { Card, Button, Badge } from '../components/ui';
import type { Project } from '../types';

export function Dashboard() {
  const { api } = useApi();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listProjects(api)
      .then(setProjects)
      .catch(() => setError('Gat ekki sótt verkefni'))
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 'var(--space-6)',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Verkefni</h1>
        <Button onClick={() => navigate('/projects/new')}>
          + Nýtt verkefni
        </Button>
      </div>

      {loading && (
        <p style={{ color: 'var(--muted)' }}>Hleður...</p>
      )}

      {error && (
        <p style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      {!loading && !error && projects.length === 0 && (
        <Card style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--muted)' }}>
          Engin verkefni enn. Búðu til nýtt verkefni.
        </Card>
      )}

      {!loading && projects.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {projects.map(p => (
            <Card
              key={p.id}
              padding="var(--space-4) var(--space-5)"
              style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>{p.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {new Date(p.created).toLocaleDateString('is-IS')}
                  </div>
                </div>
                <Badge phase={p.phase}>{p.phase}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
