import { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { loadToken } from './github/token';
import { TokenSetup } from './components/TokenSetup';
import { AppShell } from './components/AppShell';
import { ApiProvider } from './context/ApiContext';
import { Dashboard } from './pages/Dashboard';
import { NewProject } from './pages/NewProject';
import { ProjectView } from './pages/ProjectView';
import { NewBay } from './pages/NewBay';
import { BayView } from './pages/BayView';
import { NotFound } from './pages/NotFound';
import './styles.css';

export default function App() {
  const [isConnected, setIsConnected] = useState(() => loadToken() !== null);

  if (!isConnected) {
    return <TokenSetup onSuccess={() => setIsConnected(true)} />;
  }

  return (
    <ApiProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="projects/new" element={<NewProject />} />
            <Route path="projects/:projectId" element={<ProjectView />} />
            <Route path="projects/:projectId/bays/new" element={<NewBay />} />
            <Route path="projects/:projectId/bays/:bayId" element={<BayView />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </ApiProvider>
  );
}
