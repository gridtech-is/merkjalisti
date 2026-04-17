import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadStation, sendStationForReview, approveStation, rejectStation } from './stationService';
import { appendChange } from './changelogService';
import type { StationSignals } from '../types';

const mockApi = {
  readJson: vi.fn(),
  writeJson: vi.fn(),
  listDirectory: vi.fn(),
};

// Mock changelogService so we can assert appendChange calls
vi.mock('./changelogService', () => ({
  appendChange: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => vi.clearAllMocks());

describe('loadStation', () => {
  it('returns wrapped shape when file has StationSignals object', async () => {
    const station: StationSignals = { status: 'DRAFT', review: null, signals: [] };
    mockApi.readJson.mockResolvedValue({ data: station, sha: 'sha1' });
    const result = await loadStation(mockApi as never, 'p1');
    expect(result.station).toEqual(station);
    expect(result.sha).toBe('sha1');
  });

  it('migrates legacy array shape to StationSignals', async () => {
    mockApi.readJson.mockResolvedValue({ data: [], sha: 'sha1' });
    const result = await loadStation(mockApi as never, 'p1');
    expect(result.station).toEqual({ status: 'DRAFT', review: null, signals: [] });
  });

  it('returns empty DRAFT when file data is null', async () => {
    mockApi.readJson.mockResolvedValue({ data: null, sha: '' });
    const result = await loadStation(mockApi as never, 'p1');
    expect(result.station).toEqual({ status: 'DRAFT', review: null, signals: [] });
  });
});

describe('sendStationForReview', () => {
  it('sets status=IN_REVIEW and creates review', async () => {
    const station: StationSignals = { status: 'DRAFT', review: null, signals: [] };
    mockApi.writeJson.mockResolvedValue('sha2');
    const result = await sendStationForReview(mockApi as never, 'p1', { station, sha: 'sha1' }, 'Teddi');
    expect(result.station.status).toBe('IN_REVIEW');
    expect(result.station.review?.sent_by).toBe('Teddi');
    expect(result.station.review?.status).toBe('OPEN');
    expect(mockApi.writeJson).toHaveBeenCalledWith(
      'projects/p1/station_signals.json',
      result.station,
      'sha1',
      expect.stringContaining('[REVIEW]')
    );
    expect(appendChange).toHaveBeenCalledWith(
      mockApi,
      'p1',
      expect.objectContaining({ target_type: 'station', target_id: 'p1', type: 'REVIEW_ADDED' })
    );
  });
});

describe('approveStation', () => {
  it('sets status=LOCKED with reviewed_by', async () => {
    const station: StationSignals = {
      status: 'IN_REVIEW',
      review: { sent_by: 'A', sent_at: '2026-04-17', reviewed_by: null, reviewed_at: null, status: 'OPEN', comment: null },
      signals: [],
    };
    mockApi.writeJson.mockResolvedValue('sha2');
    const result = await approveStation(mockApi as never, 'p1', { station, sha: 'sha1' }, 'Teddi', 'allt í lagi');
    expect(result.station.status).toBe('LOCKED');
    expect(result.station.review?.reviewed_by).toBe('Teddi');
    expect(result.station.review?.status).toBe('APPROVED');
    expect(result.station.review?.comment).toBe('allt í lagi');
  });
});

describe('rejectStation', () => {
  it('sets status=DRAFT with status=REJECTED in review', async () => {
    const station: StationSignals = {
      status: 'IN_REVIEW',
      review: { sent_by: 'A', sent_at: '2026-04-17', reviewed_by: null, reviewed_at: null, status: 'OPEN', comment: null },
      signals: [],
    };
    mockApi.writeJson.mockResolvedValue('sha2');
    const result = await rejectStation(mockApi as never, 'p1', { station, sha: 'sha1' }, 'Teddi', 'vantar merki');
    expect(result.station.status).toBe('DRAFT');
    expect(result.station.review?.status).toBe('REJECTED');
    expect(result.station.review?.comment).toBe('vantar merki');
  });
});
