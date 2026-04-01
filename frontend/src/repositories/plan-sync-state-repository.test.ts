import { beforeEach, describe, expect, it } from 'vitest';
import { planSyncStateRepository } from './plan-sync-state-repository';

describe('planSyncStateRepository', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        }
      },
      configurable: true
    });
  });

  it('stores pending deleted plan ids without duplicates', async () => {
    await planSyncStateRepository.markPlanDeleted(7, 'plan-1');
    await planSyncStateRepository.markPlanDeleted(7, 'plan-1');
    await planSyncStateRepository.markPlanDeleted(7, 'plan-2');

    await expect(planSyncStateRepository.listPendingDeletedPlanIds(7)).resolves.toEqual(['plan-1', 'plan-2']);
  });

  it('clears only confirmed deleted plan ids', async () => {
    await planSyncStateRepository.markPlanDeleted(7, 'plan-1');
    await planSyncStateRepository.markPlanDeleted(7, 'plan-2');

    await planSyncStateRepository.clearPendingDeletedPlanIds(7, ['plan-1']);

    await expect(planSyncStateRepository.listPendingDeletedPlanIds(7)).resolves.toEqual(['plan-2']);
  });
});
