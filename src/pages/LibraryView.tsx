// src/pages/LibraryView.tsx
import { useState } from 'react';

type LibTab = 'signals' | 'states' | 'templates';

export function LibraryView() {
  const [tab, setTab] = useState<LibTab>('signals');

  const tabStyle = (t: LibTab): React.CSSProperties => ({
    background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer',
    fontSize: '13px', fontWeight: tab === t ? 600 : 400,
    color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
    borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
    marginBottom: '-1px',
  });

  return (
    <div>
      <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
        Library
      </h1>
      <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--line)', marginBottom: 'var(--space-6)' }}>
        <button type="button" style={tabStyle('signals')} onClick={() => setTab('signals')}>Merkjasafn</button>
        <button type="button" style={tabStyle('states')} onClick={() => setTab('states')}>Stöður</button>
        <button type="button" style={tabStyle('templates')} onClick={() => setTab('templates')}>Sniðmát</button>
      </div>

      {tab === 'signals' && <p style={{ color: 'var(--muted)' }}>Merkjasafn — kemur bráðlega</p>}
      {tab === 'states' && <p style={{ color: 'var(--muted)' }}>Stöður — kemur bráðlega</p>}
      {tab === 'templates' && <p style={{ color: 'var(--muted)' }}>Sniðmát — kemur bráðlega</p>}
    </div>
  );
}
