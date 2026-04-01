import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  add: vi.fn(),
  where: vi.fn(),
  bulkAdd: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('@/db', () => ({
  fitMirrorDb: {
    workoutRecords: {
      add: dbMocks.add,
      where: dbMocks.where,
      bulkAdd: dbMocks.bulkAdd
    },
    transaction: dbMocks.transaction
  }
}));

import { workoutRecordsRepository } from './workout-records-repository';

describe('workoutRecordsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.transaction.mockImplementation(async (_mode, _table, callback) => callback());
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
      clientRecordId: expect.any(String),
      date: '2026-04-01',
      duration: 18,
      completed: true,
      planId: 3,
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });
    expect(result).toMatchObject({
      userId: 7,
      date: '2026-04-01',
      duration: 18,
      completed: true,
      planId: 3
    });
    expect(result.id).toBe(9);
    expect(result.clientRecordId).toEqual(expect.any(String));
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

  it('replaces all records for one user with cloud-synced data', async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    dbMocks.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        delete: deleteMock
      })
    });

    await workoutRecordsRepository.replaceRecordsForUser(7, [
      {
        clientRecordId: 'rec-001',
        date: '2026-04-01',
        duration: 20,
        completed: true,
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:05:00.000Z'
      }
    ]);

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(dbMocks.bulkAdd).toHaveBeenCalledWith([
      {
        userId: 7,
        clientRecordId: 'rec-001',
        date: '2026-04-01',
        duration: 20,
        completed: true,
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:05:00.000Z'
      }
    ]);
  });
});
