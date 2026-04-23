import { createContext, useContext, useState } from 'react';
import type React from 'react';

interface ProjectNav {
  projectId: string | null;
  projectName: string | null;
  setProject: (id: string, name: string) => void;
}

const ProjectNavContext = createContext<ProjectNav>({
  projectId: null, projectName: null, setProject: () => {},
});

export function ProjectNavProvider({ children }: { children: React.ReactNode }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

  const setProject = (id: string, name: string) => {
    setProjectId(id);
    setProjectName(name);
  };

  return (
    <ProjectNavContext.Provider value={{ projectId, projectName, setProject }}>
      {children}
    </ProjectNavContext.Provider>
  );
}

export const useProjectNav = () => useContext(ProjectNavContext);
