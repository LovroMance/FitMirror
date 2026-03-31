import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  add: vi.fn(),
  where: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}));

vi.mock('@/db', () => ({
  fitMirrorDb: {
    exercisePreferences: {
      add: dbMocks.add,
      where: dbMocks.where,
      put: dbMocks.put,
      delete: dbMocks.delete
    }
  }
}));

import { exercisePreferencesRepository } from './exercise-preferences-repository';

describe('exercisePreferencesRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggles favorite on for a new exercise', async () => {
    dbMocks.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(undefined)
      })
    });
    dbMocks.add.mockResolvedValue(3);

    const result = await exercisePreferencesRepository.toggleFavorite(7, 'ex-001');

    expect(result).toMatchObject({
      id: 3,
      userId: 7,
      exerciseId: 'ex-001',
      isFavorite: true
    });
  });

  it('keeps recent viewed list capped at 10 items', async () => {
    const existing = Array.from({ length: 11 }, (_, index) => ({
      id: index + 1,
      userId: 7,
      exerciseId: `ex-${index + 1}`,
      isFavorite: false,
      lastViewedAt: `2026-04-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      updatedAt: `2026-04-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
    }));

    dbMocks.where
      .mockReturnValueOnce({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(undefined)
        })
      })
      .mockReturnValueOnce({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(existing)
        })
      });

    await exercisePreferencesRepository.touchRecentlyViewed(7, 'ex-999');

    expect(dbMocks.add).toHaveBeenCalledTimes(1);
    expect(dbMocks.put).toHaveBeenCalledTimes(1);
  });
});
