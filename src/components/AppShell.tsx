import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Verkefni', icon: '⊞', end: true },
  { to: '/library', label: 'Library', icon: '◈', end: false },
];

export function AppShell() {
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
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
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
            })}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <main style={{ flex: 1, overflow: 'auto', padding: 'var(--space-6)' }}>
        <Outlet />
      </main>
    </div>
  );
}
