import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  add: vi.fn(),
  where: vi.fn()
}));

vi.mock('@/db', () => ({
  fitMirrorDb: {
    workoutRecords: {
      add: dbMocks.add,
      where: dbMocks.where
    }
  }
}));

import { workoutRecordsRepository } from './workout-records-repository';

describe('workoutRecordsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a workout record and returns the persisted entity', async () => {
    dbMocks.add.mockResolvedValue(9);

    const result = await workoutRecordsRepository.createRecord({
      userId: 7,
      date: '2026-04-01',
      duration: 18,
      completed: true,
      planId: 3
    });

    expect(dbMocks.add).toHaveBeenCalledWith({
      userId: 7,
      date: '2026-04-01',
      duration: 18,
      completed: true,
      planId: 3
    });
    expect(result).toEqual({
      id: 9,
      userId: 7,
      date: '2026-04-01',
      duration: 18,
      completed: true,
      planId: 3
    });
  });

  it('filters records by date range and keeps them sorted by date', async () => {
    dbMocks.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { id: 1, userId: 7, date: '2026-03-31', duration: 12, completed: true },
          { id: 2, userId: 7, date: '2026-04-02', duration: 15, completed: true },
          { id: 3, userId: 7, date: '2026-04-01', duration: 20, completed: false }
        ])
      })
    });

    const result = await workoutRecordsRepository.listRecordsByDateRange(7, '2026-04-01', '2026-04-02');

    expect(result.map((item) => item.id)).toEqual([3, 2]);
  });

  it('lists one-day records with completed sessions first', async () => {
    dbMocks.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { id: 1, userId: 7, date: '2026-04-01', duration: 10, completed: false },
          { id: 2, userId: 7, date: '2026-04-01', duration: 20, completed: true }
        ])
      })
    });

    const result = await workoutRecordsRepository.listRecordsByDay(7, '2026-04-01');

    expect(result.map((item) => item.id)).toEqual([2, 1]);
  });
});
