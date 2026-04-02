import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mountedCallbacks, routerPush, routeMock, syncPlansForUser, plansRepositoryMocks, workoutRecordsRepositoryMocks } = vi.hoisted(() => ({
  mountedCallbacks: [] as Array<() => unknown>,
  routerPush: vi.fn(),
  routeMock: {
    query: {
      planId: '2'
    }
  },
  syncPlansForUser: vi.fn(),
  plansRepositoryMocks: {
    listPlansByUser: vi.fn(),
    getPlanById: vi.fn(),
    deletePlan: vi.fn()
  },
  workoutRecordsRepositoryMocks: {
    listRecordsByUser: vi.fn()
  }
}));

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue');
  return {
    ...actual,
    onMounted: (callback: () => unknown) => {
      mountedCallbacks.push(callback);
    },
    nextTick: async () => undefined
  };
});

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush
  }),
  useRoute: () => routeMock
}));

vi.mock('@/composables/plan/usePlanSync', () => ({
  syncPlansForUser
}));

vi.mock('@/repositories', () => ({
  plansRepository: plansRepositoryMocks,
  workoutRecordsRepository: workoutRecordsRepositoryMocks,
  planSyncStateRepository: {
    markPlanDeleted: vi.fn()
  }
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    currentUser: {
      id: 7
    }
  })
}));

vi.mock('element-plus', () => ({
  ElMessage: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn()
  },
  ElMessageBox: {
    confirm: vi.fn()
  }
}));

import { usePlanHistory } from './usePlanHistory';

describe('usePlanHistory', () => {
  beforeEach(() => {
    mountedCallbacks.length = 0;
    vi.clearAllMocks();
    routeMock.query.planId = '2';
    syncPlansForUser.mockResolvedValue(undefined);
  });

  it('sorts used plans first and keeps a routed target visible even when the preselected filter would hide it', async () => {
    plansRepositoryMocks.listPlansByUser.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        clientPlanId: 'plan-1',
        goalText: '肩背唤醒',
        createdAt: '2026-04-01T08:00:00.000Z',
        updatedAt: '2026-04-01T08:00:00.000Z',
        planJson: {
          title: '肩背激活',
          level: 'beginner',
          durationMinutes: 12,
          summary: '快速唤醒肩背',
          exercises: [
            {
              name: '弹力带划船',
              reps: '12 次',
              restSeconds: 20,
              instruction: '保持肩胛稳定'
            }
          ]
        }
      },
      {
        id: 2,
        userId: 7,
        clientPlanId: 'plan-2',
        goalText: '核心训练',
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:00:00.000Z',
        planJson: {
          title: '核心激活',
          level: 'beginner',
          durationMinutes: 18,
          summary: '激活核心',
          exercises: [
            {
              name: '平板支撑',
              durationSeconds: 30,
              restSeconds: 20,
              instruction: '保持核心收紧'
            }
          ]
        }
      },
      {
        id: 3,
        userId: 7,
        clientPlanId: 'plan-3',
        goalText: '腿部拉伸',
        createdAt: '2026-04-03T09:00:00.000Z',
        updatedAt: '2026-04-03T09:00:00.000Z',
        planJson: {
          title: '下肢放松',
          level: 'beginner',
          durationMinutes: 10,
          summary: '下肢恢复拉伸',
          exercises: [
            {
              name: '站姿腿后侧拉伸',
              durationSeconds: 40,
              restSeconds: 20,
              instruction: '呼吸均匀'
            }
          ]
        }
      }
    ]);
    workoutRecordsRepositoryMocks.listRecordsByUser.mockResolvedValue([
      {
        id: 2,
        userId: 7,
        clientRecordId: 'rec-2',
        date: '2026-04-01',
        duration: 12,
        completed: true,
        planId: 1,
        createdAt: '2026-04-01T09:00:00.000Z',
        updatedAt: '2026-04-01T09:10:00.000Z'
      },
      {
        id: 1,
        userId: 7,
        clientRecordId: 'rec-1',
        date: '2026-04-02',
        duration: 18,
        completed: true,
        planId: 2,
        createdAt: '2026-04-02T11:00:00.000Z',
        updatedAt: '2026-04-02T11:10:00.000Z'
      }
    ]);

    const history = usePlanHistory();
    history.selectedFilter.value = 'unused';
    await mountedCallbacks[0]?.();

    expect(syncPlansForUser).toHaveBeenCalledWith(7);
    expect(history.selectedFilter.value).toBe('used');
    expect(history.expandedPlanId.value).toBe(2);
    expect(history.highlightedPlanId.value).toBe(2);
    expect(history.items.value.map((item) => item.id)).toEqual([2, 1, 3]);
    expect(history.filteredItems.value.map((item) => item.id)).toEqual([2, 1]);
    expect(history.items.value[0]).toMatchObject({
      id: 2,
      usedWorkoutCount: 1,
      usageBadge: '最近使用'
    });
  });

  it('filters between all, used, and unused plans after load', async () => {
    routeMock.query.planId = undefined;
    plansRepositoryMocks.listPlansByUser.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        clientPlanId: 'plan-1',
        goalText: '核心训练',
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:00:00.000Z',
        planJson: {
          title: '核心激活',
          level: 'beginner',
          durationMinutes: 18,
          summary: '激活核心',
          exercises: [
            {
              name: '平板支撑',
              durationSeconds: 30,
              restSeconds: 20,
              instruction: '保持核心收紧'
            }
          ]
        }
      },
      {
        id: 2,
        userId: 7,
        clientPlanId: 'plan-2',
        goalText: '拉伸训练',
        createdAt: '2026-04-03T10:00:00.000Z',
        updatedAt: '2026-04-03T10:00:00.000Z',
        planJson: {
          title: '拉伸恢复',
          level: 'beginner',
          durationMinutes: 15,
          summary: '恢复放松',
          exercises: [
            {
              name: '猫牛式',
              durationSeconds: 45,
              restSeconds: 15,
              instruction: '配合呼吸活动脊柱'
            }
          ]
        }
      }
    ]);
    workoutRecordsRepositoryMocks.listRecordsByUser.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        clientRecordId: 'rec-1',
        date: '2026-04-02',
        duration: 18,
        completed: true,
        planId: 1,
        createdAt: '2026-04-02T11:00:00.000Z',
        updatedAt: '2026-04-02T11:10:00.000Z'
      }
    ]);

    const history = usePlanHistory();
    await mountedCallbacks[0]?.();

    expect(history.filteredItems.value.map((item) => item.id)).toEqual([1, 2]);

    history.setFilter('used');
    expect(history.filteredItems.value.map((item) => item.id)).toEqual([1]);

    history.setFilter('unused');
    expect(history.filteredItems.value.map((item) => item.id)).toEqual([2]);
  });
});
