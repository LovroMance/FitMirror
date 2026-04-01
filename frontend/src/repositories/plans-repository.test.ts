import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistedPlan, TrainingPlan } from '@/types/plan';

const dbMocks = vi.hoisted(() => ({
  add: vi.fn(),
  where: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  bulkAdd: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('@/db', () => ({
  fitMirrorDb: {
    plans: {
      add: dbMocks.add,
      where: dbMocks.where,
      get: dbMocks.get,
      delete: dbMocks.delete,
      bulkAdd: dbMocks.bulkAdd
    },
    transaction: dbMocks.transaction
  }
}));

import { plansRepository } from './plans-repository';

class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

const samplePlan: TrainingPlan = {
  title: '12分钟核心训练',
  level: 'beginner',
  durationMinutes: 12,
  summary: '适合居家执行的基础训练计划。',
  exercises: [
    {
      name: '平板支撑',
      durationSeconds: 30,
      restSeconds: 20,
      instruction: '保持身体成一直线。'
    }
  ]
};

describe('plansRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', new LocalStorageMock());
    dbMocks.transaction.mockImplementation(async (_mode, _table, callback) => callback());
  });

  it('migrates legacy localStorage plan once and returns the latest record', async () => {
    const persistedPlan: PersistedPlan = {
      goalText: '瘦肚子 每天10分钟',
      createdAt: '2026-03-20T00:00:00.000Z',
      plan: samplePlan
    };

    localStorage.setItem('fitmirror_latest_plan', JSON.stringify(persistedPlan));
    dbMocks.add.mockResolvedValue(99);
    dbMocks.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        sortBy: vi.fn().mockResolvedValue([
          {
            id: 3,
            userId: 7,
            clientPlanId: 'plan-old',
            goalText: '旧计划',
            planJson: samplePlan,
            createdAt: '2026-03-19T00:00:00.000Z',
            updatedAt: '2026-03-19T00:00:00.000Z'
          },
          {
            id: 4,
            userId: 7,
            clientPlanId: 'plan-new',
            goalText: '新计划',
            planJson: samplePlan,
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-21T00:00:00.000Z'
          }
        ])
      })
    });

    const latest = await plansRepository.loadLatestPlan(7);

    expect(dbMocks.add).toHaveBeenCalledWith({
      userId: 7,
      clientPlanId: expect.any(String),
      goalText: persistedPlan.goalText,
      planJson: persistedPlan.plan,
      createdAt: persistedPlan.createdAt,
      updatedAt: persistedPlan.createdAt
    });
    expect(localStorage.getItem('fitmirror_latest_plan')).toBeNull();
    expect(localStorage.getItem('fitmirror_latest_plan_migrated_v1')).toBe('1');
    expect(latest?.id).toBe(4);
  });

  it('deletes an explicit plan only when it belongs to the current user', async () => {
    dbMocks.get.mockResolvedValue({ id: 8, userId: 7 });

    await plansRepository.deletePlan(7, 8);

    expect(dbMocks.delete).toHaveBeenCalledWith(8);
  });

  it('returns a plan by id only when it belongs to the current user', async () => {
    dbMocks.get.mockResolvedValue({
      id: 12,
      userId: 7,
      clientPlanId: 'plan-12',
      goalText: '目标',
      planJson: samplePlan,
      createdAt: '2026-03-31',
      updatedAt: '2026-03-31'
    });

    await expect(plansRepository.getPlanById(7, 12)).resolves.toMatchObject({ id: 12 });
    await expect(plansRepository.getPlanById(8, 12)).resolves.toBeNull();
  });

  it('lists plans by user in reverse chronological order', async () => {
    dbMocks.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        sortBy: vi.fn().mockResolvedValue([
          {
            id: 1,
            userId: 7,
            clientPlanId: 'plan-1',
            goalText: '旧计划',
            planJson: samplePlan,
            createdAt: '2026-03-19T00:00:00.000Z',
            updatedAt: '2026-03-19T00:00:00.000Z'
          },
          {
            id: 2,
            userId: 7,
            clientPlanId: 'plan-2',
            goalText: '新计划',
            planJson: samplePlan,
            createdAt: '2026-03-21T00:00:00.000Z',
            updatedAt: '2026-03-21T00:00:00.000Z'
          }
        ])
      })
    });

    const result = await plansRepository.listPlansByUser(7);

    expect(result.map((item) => item.id)).toEqual([2, 1]);
  });

  it('replaces all plans for one user with synced cloud data', async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    dbMocks.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        delete: deleteMock
      })
    });

    await plansRepository.replacePlansForUser(7, [
      {
        clientPlanId: 'plan-001',
        goalText: '练核心',
        planJson: samplePlan,
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:05:00.000Z'
      }
    ]);

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(dbMocks.bulkAdd).toHaveBeenCalledWith([
      {
        userId: 7,
        clientPlanId: 'plan-001',
        goalText: '练核心',
        planJson: samplePlan,
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-01T10:05:00.000Z'
      }
    ]);
  });
});
