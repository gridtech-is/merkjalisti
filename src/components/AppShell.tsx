import { NavLink, Outlet, useMatch } from 'react-router-dom';

export function AppShell() {
  const projectMatch = useMatch('/projects/:projectId/*');
  const projectId = projectMatch?.params.projectId;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <nav style={{
        width: '200px',
        flexShrink: 0,
        background: 'var(--bg-subtle)',
        borderRight: '1px solid var(--line)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-4)',
        gap: 'var(--space-2)',
      }}>
        <div style={{
          padding: 'var(--space-3) var(--space-2)',
          marginBottom: 'var(--space-4)',
          borderBottom: '1px solid var(--line)',
        }}>
          <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--accent)' }}>
            Merkjalisti
          </span>
        </div>

        <NavLink to="/" end style={navStyle}>
          <span>⊞</span><span>Verkefni</span>
        </NavLink>

        <NavLink to="/library" style={navStyle}>
          <span>◈</span><span>Library</span>
        </NavLink>

        {projectId && (
          <>
            <div style={{ height: '1px', background: 'var(--line)', margin: 'var(--space-2) 0' }} />
            <NavLink to={`/projects/${projectId}`} end style={navStyle}>
              <span>⬡</span><span>Reitir</span>
            </NavLink>
          </>
        )}
      </nav>
      <main style={{ flex: 1, overflow: 'auto', padding: 'var(--space-6)' }}>
        <Outlet />
      </main>
    </div>
  );
}

function navStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: '6px var(--space-3)',
    borderRadius: 'var(--radius-sm)',
    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
    background: isActive ? 'var(--accent-focus)' : 'transparent',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: isActive ? 600 : 400,
  };
}
