import { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { loadToken } from './github/token';
import { TokenSetup } from './components/TokenSetup';
import { AppShell } from './components/AppShell';
import { Dashboard } from './pages/Dashboard';
import { NotFound } from './pages/NotFound';
import './styles.css';

export default function App() {
  const [isConnected, setIsConnected] = useState(() => loadToken() !== null);

  if (!isConnected) {
    return <TokenSetup onSuccess={() => setIsConnected(true)} />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
