import { describe, it, expect, vi } from 'vitest';
import { loadZenonConfig, saveZenonConfig } from './zenonConfigService';

const mockApi = {
  readJson: vi.fn(),
  writeJson: vi.fn(),
};

describe('loadZenonConfig', () => {
  it('returns config and sha when file exists', async () => {
    const config = { driver_name: 'IEC850_2', net_addr: { PROT1: 3 } };
    mockApi.readJson.mockResolvedValueOnce({ data: config, sha: 'abc123' });

    const result = await loadZenonConfig(mockApi as any, 'proj-1');

    expect(mockApi.readJson).toHaveBeenCalledWith('projects/proj-1/zenon_config.json');
    expect(result).toEqual({ data: config, sha: 'abc123' });
  });

  it('returns default config and null sha when file does not exist', async () => {
    mockApi.readJson.mockRejectedValueOnce(new Error('Not Found'));

    const result = await loadZenonConfig(mockApi as any, 'proj-1');

    expect(result).toEqual({
      data: { driver_name: 'IEC850', net_addr: {} },
      sha: null,
    });
  });
});

describe('saveZenonConfig', () => {
  it('calls writeJson with correct path and returns new sha', async () => {
    mockApi.writeJson.mockResolvedValueOnce('newsha');
    const config = { driver_name: 'IEC850', net_addr: { CTRL1: 1 } };

    const sha = await saveZenonConfig(mockApi as any, 'proj-1', config, 'oldsha');

    expect(mockApi.writeJson).toHaveBeenCalledWith(
      'projects/proj-1/zenon_config.json',
      config,
      'oldsha',
      'Zenon stillingar uppfærðar',
    );
    expect(sha).toBe('newsha');
  });

  it('passes null sha when file is new', async () => {
    mockApi.writeJson.mockResolvedValueOnce('firstsha');
    const config = { driver_name: 'IEC850', net_addr: {} };

    await saveZenonConfig(mockApi as any, 'proj-1', config, null);

    expect(mockApi.writeJson).toHaveBeenCalledWith(
      'projects/proj-1/zenon_config.json',
      config,
      null,
      'Zenon stillingar uppfærðar',
    );
  });
});
