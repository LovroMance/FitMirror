import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMocks = vi.hoisted(() => ({
  syncRecords: vi.fn()
}));

vi.mock('./workout-records.repository', () => ({
  workoutRecordsRepository: {
    syncRecords: repositoryMocks.syncRecords
  }
}));

import { syncWorkoutRecords } from './workout-records.service';

describe('workout-records.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns synced workout records as dto payload', async () => {
    repositoryMocks.syncRecords.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        clientRecordId: 'rec-001',
        date: '2026-04-01',
        duration: 20,
        completed: true,
        planId: 3,
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
        updatedAt: new Date('2026-04-01T10:05:00.000Z')
      }
    ]);

    const result = await syncWorkoutRecords(7, {
      records: [
        {
          clientRecordId: 'rec-001',
          date: '2026-04-01',
          duration: 20,
          completed: true,
          planId: 3,
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:05:00.000Z'
        }
      ]
    });

    expect(repositoryMocks.syncRecords).toHaveBeenCalledWith(7, [
      expect.objectContaining({
        clientRecordId: 'rec-001'
      })
    ]);
    expect(result).toEqual({
      records: [
        {
          clientRecordId: 'rec-001',
          date: '2026-04-01',
          duration: 20,
          completed: true,
          planId: 3,
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:05:00.000Z'
        }
      ]
    });
  });
});
