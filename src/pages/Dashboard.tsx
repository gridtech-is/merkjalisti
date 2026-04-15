import { Card } from '../components/ui';

export function Dashboard() {
  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-6)',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Verkefni</h1>
      </div>
      <Card style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--muted)' }}>
        Engin verkefni enn. Búðu til nýtt verkefni.
      </Card>
    </div>
  );
}
