import { useState } from 'react';
import { saveToken } from '../github/token';
import { GitHubApi } from '../github/api';
import { Button, Card } from './ui';

interface Props {
  onSuccess: () => void;
}

export function TokenSetup({ onSuccess }: Props) {
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('gridtech-is');
  const [repo, setRepo] = useState('merkjalisti-data');
  const [status, setStatus] = useState<'idle' | 'checking' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('checking');
    setError('');
    try {
      const api = new GitHubApi(token, owner, repo);
      await api.listDirectory('data');
      saveToken(token, owner, repo);
      onSuccess();
    } catch {
      setStatus('error');
      setError('Gat ekki tengst. Athugaðu token og repo nafn.');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-alt)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    padding: '8px 12px',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
      background: 'var(--bg)',
    }}>
      <Card style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            Merkjalisti
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Settu upp GitHub aðgang til að byrja. Token þarf{' '}
            <code style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>repo</code> leyfi.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              GitHub Personal Access Token
            </span>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              required
              autoComplete="off"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              GitHub Owner (org eða notandanafn)
            </span>
            <input
              type="text"
              value={owner}
              onChange={e => setOwner(e.target.value)}
              required
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Gagnageymsla (repo)
            </span>
            <input
              type="text"
              value={repo}
              onChange={e => setRepo(e.target.value)}
              required
              style={inputStyle}
            />
          </label>

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</p>
          )}

          <Button type="submit" disabled={status === 'checking'}>
            {status === 'checking' ? 'Athuga...' : 'Tengjast'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
