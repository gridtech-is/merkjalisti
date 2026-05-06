import { NavLink, Link, Outlet, useMatch, useLocation } from 'react-router-dom';
import { useProjectNav } from '../context/ProjectNavContext';

const PROJECT_NAV = [
  { tab: 'bays',      label: 'Reitir' },
  { tab: 'equipment', label: 'Tæki' },
  { tab: 'station',   label: 'Stöðvarmerki' },
  { tab: 'overview',  label: 'Heildar listi' },
  { tab: 'zenon',     label: 'Zenon' },
  { tab: 'changelog', label: 'Breytingasaga' },
];

export function AppShell() {
  const projectRouteMatch = useMatch('/projects/:projectId/*');
  const projectId = projectRouteMatch?.params.projectId;
  const isBayRoute = !!useMatch('/projects/:projectId/bays/:bayId');
  const isZenonRoute = !!useMatch('/projects/:projectId/zenon');
  const location = useLocation();
  const { projectName } = useProjectNav();

  const searchParams = new URLSearchParams(location.search);
  const activeTab = isBayRoute ? 'bays' : isZenonRoute ? 'zenon' : (searchParams.get('tab') ?? 'bays');

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <nav style={{
        width: '200px', flexShrink: 0,
        background: 'var(--bg-subtle)', borderRight: '1px solid var(--line)',
        display: 'flex', flexDirection: 'column',
        padding: 'var(--space-4)', gap: 'var(--space-1)',
        overflowY: 'auto',
      }}>
        <div style={{ padding: 'var(--space-3) var(--space-2)', marginBottom: 'var(--space-2)', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--accent)' }}>Merkjalisti</span>
        </div>

        <NavLink to="/" end style={navStyle}><span>⊞</span><span>Verkefni</span></NavLink>
        <NavLink to="/library" style={navStyle}><span>◈</span><span>Library</span></NavLink>

        {projectId && (
          <>
            <div style={{ height: '1px', background: 'var(--line)', margin: 'var(--space-3) 0 var(--space-2)' }} />

            {projectName && (
              <div style={{
                padding: '4px var(--space-2)', marginBottom: 'var(--space-1)',
                fontSize: '12px', fontWeight: 700, color: 'var(--text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }} title={projectName}>
                {projectName}
              </div>
            )}

            {PROJECT_NAV.map(({ tab, label }) => {
              const to = tab === 'bays'
                ? `/projects/${projectId}`
                : tab === 'zenon'
                ? `/projects/${projectId}/zenon`
                : `/projects/${projectId}?tab=${tab}`;
              const isActive = activeTab === tab;
              return (
                <Link key={tab} to={to} style={{
                  display: 'block',
                  padding: '6px var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-focus)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 400,
                }}>
                  {label}
                </Link>
              );
            })}
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
    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
    padding: '6px var(--space-3)', borderRadius: 'var(--radius-sm)',
    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
    background: isActive ? 'var(--accent-focus)' : 'transparent',
    textDecoration: 'none', fontSize: '13px',
    fontWeight: isActive ? 600 : 400,
  };
}
