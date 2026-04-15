// src/services/changelogService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appendChange } from './changelogService';
import type { ChangeEntry } from '../types';

const mockApi = {
  readJson: vi.fn(),
  writeJson: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('appendChange', () => {
  it('reads existing changelog, appends entry, writes back', async () => {
    const existing: ChangeEntry[] = [];
    mockApi.readJson.mockResolvedValue({ data: existing, sha: 'sha1' });
    mockApi.writeJson.mockResolvedValue('sha2');

    await appendChange(mockApi as never, 'proj-123', {
      user: 'Teddi',
      phase: 'DESIGN',
      type: 'FIELD_CHANGED',
      target_id: 'sig-1',
      target_type: 'signal',
      field: 'iec61850_address',
      old_value: null,
      new_value: '55E00BCF1/PROT/PTRC1$ST$Tr',
      comment: '',
    });

    expect(mockApi.writeJson).toHaveBeenCalledOnce();
    const [, data] = mockApi.writeJson.mock.calls[0] as [string, ChangeEntry[]];
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe('FIELD_CHANGED');
    expect(data[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(data[0].timestamp).toBeTruthy();
  });
});
