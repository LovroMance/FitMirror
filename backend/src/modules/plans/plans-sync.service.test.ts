import { beforeEach, describe, expect, it, vi } from 'vitest';

const repositoryMocks = vi.hoisted(() => ({
  syncPlans: vi.fn()
}));

vi.mock('./plans-sync.repository', () => ({
  plansSyncRepository: {
    syncPlans: repositoryMocks.syncPlans
  }
}));

import { syncPlans } from './plans-sync.service';

describe('plans-sync.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns synced plans as dto payload', async () => {
    repositoryMocks.syncPlans.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        clientPlanId: 'plan-001',
        goalText: '练核心',
        planJson: {
          title: '12分钟核心训练',
          level: 'beginner',
          durationMinutes: 12,
          summary: 'summary',
          exercises: [{ name: '平板支撑', durationSeconds: 30, restSeconds: 20, instruction: '保持稳定。' }]
        },
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
        updatedAt: new Date('2026-04-01T10:05:00.000Z')
      }
    ]);

    const result = await syncPlans(7, {
      plans: [
        {
          clientPlanId: 'plan-001',
          goalText: '练核心',
          planJson: {
            title: '12分钟核心训练',
            level: 'beginner',
            durationMinutes: 12,
            summary: 'summary',
            exercises: [{ name: '平板支撑', durationSeconds: 30, restSeconds: 20, instruction: '保持稳定。' }]
          },
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:05:00.000Z'
        }
      ],
      deletedClientPlanIds: ['plan-removed']
    });

    expect(repositoryMocks.syncPlans).toHaveBeenCalledWith(
      7,
      [expect.objectContaining({ clientPlanId: 'plan-001' })],
      ['plan-removed']
    );
    expect(result).toEqual({
      plans: [
        {
          clientPlanId: 'plan-001',
          goalText: '练核心',
          planJson: {
            title: '12分钟核心训练',
            level: 'beginner',
            durationMinutes: 12,
            summary: 'summary',
            exercises: [{ name: '平板支撑', durationSeconds: 30, restSeconds: 20, instruction: '保持稳定。' }]
          },
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-01T10:05:00.000Z'
        }
      ]
    });
  });
});
