// src/pages/Dashboard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';

// Mock ApiContext
vi.mock('../context/ApiContext', () => ({
  useApi: () => ({
    api: {
      listDirectory: vi.fn().mockResolvedValue(['.gitkeep']),
      readJson: vi.fn(),
    },
    owner: 'gridtech-is',
    repo: 'merkjalisti-data',
    userName: 'Teddi',
  }),
}));

describe('Dashboard', () => {
  it('shows empty state when no projects', async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/Engin verkefni/i)).toBeInTheDocument();
    });
  });

  it('shows Nýtt verkefni button', async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Nýtt verkefni/i })).toBeInTheDocument();
  });
});
