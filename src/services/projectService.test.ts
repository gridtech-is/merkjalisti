// src/services/projectService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createProject,
  listProjects,
  loadProject,
  saveProject,
  type ProjectFiles,
} from './projectService';
import type { Project, Equipment } from '../types';

// Mock GitHubApi
const mockApi = {
  readJson: vi.fn(),
  writeJson: vi.fn(),
  listDirectory: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('createProject', () => {
  it('writes project.json, equipment.json, station_signals.json, changelog.json, testing.json', async () => {
    mockApi.writeJson.mockResolvedValue('sha123');

    const result = await createProject(
      mockApi as never,
      'Hamrahlíð 66kV',
      'Teddi'
    );

    expect(mockApi.writeJson).toHaveBeenCalledTimes(5);
    const paths = mockApi.writeJson.mock.calls.map((c: unknown[]) => c[0]);
    expect(paths.some((p: string) => p.endsWith('project.json'))).toBe(true);
    expect(paths.some((p: string) => p.endsWith('equipment.json'))).toBe(true);
    expect(paths.some((p: string) => p.endsWith('station_signals.json'))).toBe(true);
    expect(paths.some((p: string) => p.endsWith('changelog.json'))).toBe(true);
    expect(paths.some((p: string) => p.endsWith('testing.json'))).toBe(true);

    expect(result.project.name).toBe('Hamrahlíð 66kV');
    expect(result.project.phase).toBe('DESIGN');
    expect(result.project.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
  });
});

describe('listProjects', () => {
  it('returns empty array when no projects', async () => {
    mockApi.listDirectory.mockResolvedValue(['.gitkeep']);
    const result = await listProjects(mockApi as never);
    expect(result).toEqual([]);
  });

  it('reads project.json for each uuid directory', async () => {
    const projectId = '550e8400-e29b-41d4-a716-446655440000';
    mockApi.listDirectory.mockResolvedValue([projectId, '.gitkeep']);
    mockApi.readJson.mockResolvedValue({
      data: {
        id: projectId, name: 'Test Station', phase: 'DESIGN',
        description: '', created: '2026-01-01T00:00:00Z', review: null,
      } as Project,
      sha: 'abc123',
    });

    const result = await listProjects(mockApi as never);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test Station');
  });
});

describe('loadProject', () => {
  it('reads all project files', async () => {
    const projectId = '550e8400-e29b-41d4-a716-446655440000';
    mockApi.readJson
      .mockResolvedValueOnce({ data: { id: projectId, name: 'X', phase: 'DESIGN', description: '', created: '2026-01-01T00:00:00Z', review: null }, sha: 's1' })
      .mockResolvedValueOnce({ data: [] as Equipment[], sha: 's2' })
      .mockResolvedValueOnce({ data: [], sha: 's3' })
      .mockResolvedValueOnce({ data: [], sha: 's4' })
      .mockResolvedValueOnce({ data: { fat_started: null, fat_completed: null, sat_started: null, sat_completed: null, entries: [] }, sha: 's5' });

    const result = await loadProject(mockApi as never, projectId);
    expect(result.project.id).toBe(projectId);
    expect(result.equipment).toEqual([]);
    expect(result.changelog).toEqual([]);
  });
});
