// src/services/bayService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBay, listBays, renameStation } from './bayService';
import type { Bay } from '../types';

const mockApi = {
  readJson: vi.fn(),
  writeJson: vi.fn(),
  listDirectory: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('createBay', () => {
  it('writes bay json with station_number-derived display_id', async () => {
    mockApi.writeJson.mockResolvedValue('sha1');
    await createBay(mockApi as never, 'proj-123', '55', 'J', 'E00', [], 'Teddi');

    expect(mockApi.writeJson).toHaveBeenCalledOnce();
    const [path, data] = mockApi.writeJson.mock.calls[0] as [string, Bay];
    expect(path).toMatch(/^projects\/proj-123\/bays\//);
    expect(data.display_id).toBe('55E00');
    expect(data.bay_name).toBe('E00');
    // station field should no longer exist
    expect('station' in data).toBe(false);
  });
});

describe('listBays', () => {
  it('returns empty array when no bays directory entries', async () => {
    mockApi.listDirectory.mockResolvedValue([]);
    const result = await listBays(mockApi as never, 'proj-123');
    expect(result).toEqual([]);
  });

  it('reads each bay file', async () => {
    const bayId = '550e8400-e29b-41d4-a716-446655440001';
    mockApi.listDirectory.mockResolvedValue([`${bayId}.json`]);
    mockApi.readJson.mockResolvedValue({
      data: { id: bayId, voltage_level: 'J', bay_name: 'E00', display_id: '55E00', equipment_ids: [], signals: [], status: 'DRAFT', review: null } as Bay,
      sha: 'sha1',
    });

    const result = await listBays(mockApi as never, 'proj-123');
    expect(result).toHaveLength(1);
    expect(result[0].display_id).toBe('55E00');
  });
});

describe('renameStation', () => {
  it('updates display_id on all bays for the project', async () => {
    const bayId = '550e8400-e29b-41d4-a716-446655440002';
    mockApi.listDirectory.mockResolvedValue([`${bayId}.json`]);
    mockApi.readJson.mockResolvedValue({
      data: { id: bayId, voltage_level: 'J', bay_name: 'E00', display_id: '55E00', equipment_ids: [], signals: [], status: 'DRAFT', review: null } as Bay,
      sha: 'sha-old',
    });
    mockApi.writeJson.mockResolvedValue('sha-new');

    await renameStation(mockApi as never, 'proj-123', '66');

    expect(mockApi.writeJson).toHaveBeenCalledOnce();
    const [path, data] = mockApi.writeJson.mock.calls[0] as [string, Bay];
    expect(path).toBe(`projects/proj-123/bays/${bayId}.json`);
    expect(data.display_id).toBe('66E00');
  });

  it('does nothing when project has no bays', async () => {
    mockApi.listDirectory.mockResolvedValue([]);
    await renameStation(mockApi as never, 'proj-123', '66');
    expect(mockApi.writeJson).not.toHaveBeenCalled();
  });
});
