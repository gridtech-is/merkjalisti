// src/services/bayService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBay, listBays, loadBay, saveBay } from './bayService';
import type { Bay } from '../types';

const mockApi = {
  readJson: vi.fn(),
  writeJson: vi.fn(),
  listDirectory: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('createBay', () => {
  it('writes bay json and returns bay with given signals', async () => {
    mockApi.writeJson.mockResolvedValue('sha1');
    const result = await createBay(mockApi as never, 'proj-123', '55', 'J', 'E00', [], 'Teddi');

    expect(mockApi.writeJson).toHaveBeenCalledOnce();
    const [path, data] = mockApi.writeJson.mock.calls[0] as [string, Bay];
    expect(path).toMatch(/^projects\/proj-123\/bays\//);
    expect(data.display_id).toBe('55E00');
    expect(data.station).toBe('55');
    expect(data.bay_name).toBe('E00');
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
      data: { id: bayId, station: '55', voltage_level: 'J', bay_name: 'E00', display_id: '55E00', equipment_ids: [], signals: [] } as Bay,
      sha: 'sha1',
    });

    const result = await listBays(mockApi as never, 'proj-123');
    expect(result).toHaveLength(1);
    expect(result[0].display_id).toBe('55E00');
  });
});
