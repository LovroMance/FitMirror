import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrainingPlan } from '@/types/plan';

const {
  mountedCallbacks,
  routerPush,
  routeMock,
  generatePlanStream,
  generatePlanApiWithSource,
  syncPlansForUser,
  plansRepositoryMocks,
  messageSuccess,
  messageWarning,
  messageError
} = vi.hoisted(() => ({
  mountedCallbacks: [] as Array<() => unknown>,
  routerPush: vi.fn(),
  routeMock: {
    query: {}
  },
  generatePlanStream: vi.fn(),
  generatePlanApiWithSource: vi.fn(),
  syncPlansForUser: vi.fn(),
  plansRepositoryMocks: {
    saveLatestPlan: vi.fn(),
    loadLatestPlan: vi.fn(),
    getPlanById: vi.fn(),
    getPlanByClientPlanId: vi.fn(),
    deletePlan: vi.fn()
  },
  messageSuccess: vi.fn(),
  messageWarning: vi.fn(),
  messageError: vi.fn()
}));

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue');
  return {
    ...actual,
    onMounted: (callback: () => unknown) => {
      mountedCallbacks.push(callback);
    }
  };
});

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush
  }),
  useRoute: () => routeMock
}));

vi.mock('@/api/plans', () => ({
  generatePlanStream,
  generatePlanApiWithSource
}));

vi.mock('@/composables/plan/usePlanSync', () => ({
  syncPlansForUser
}));

vi.mock('@/repositories', () => ({
  plansRepository: plansRepositoryMocks,
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
    success: messageSuccess,
    warning: messageWarning,
    error: messageError
  }
}));

import { usePlanGenerator } from './usePlanGenerator';

const samplePlan: TrainingPlan = {
  title: '10分钟核心激活训练',
  level: 'beginner',
  durationMinutes: 10,
  summary: '适合快速完成的核心训练。',
  exercises: [
    {
      name: '平板支撑',
      durationSeconds: 30,
      restSeconds: 20,
      instruction: '保持身体成一直线。'
    }
  ]
};

describe('usePlanGenerator', () => {
  beforeEach(() => {
    mountedCallbacks.length = 0;
    vi.clearAllMocks();
    routeMock.query = {};
    generatePlanStream.mockResolvedValue({
      plan: samplePlan,
      source: 'template'
    });
    syncPlansForUser.mockResolvedValue(undefined);
    plansRepositoryMocks.loadLatestPlan.mockResolvedValue(null);
    plansRepositoryMocks.getPlanById.mockResolvedValue(null);
    plansRepositoryMocks.getPlanByClientPlanId.mockResolvedValue({
      id: 22,
      userId: 7,
      clientPlanId: 'plan-client-1',
      goalText: '核心训练',
      planJson: samplePlan,
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:05:00.000Z'
    });
    plansRepositoryMocks.saveLatestPlan.mockResolvedValue({
      id: 1,
      userId: 7,
      clientPlanId: 'plan-client-1',
      goalText: '核心训练',
      planJson: samplePlan,
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:05:00.000Z'
    });
  });

  it('refreshes latestPlanId from clientPlanId after sync replaces local ids', async () => {
    const generator = usePlanGenerator();
    await mountedCallbacks[0]?.();
    generator.goalText.value = '核心训练';

    await generator.handleGenerate();

    expect(syncPlansForUser).toHaveBeenCalledWith(7);
    expect(plansRepositoryMocks.getPlanByClientPlanId).toHaveBeenCalledWith(7, 'plan-client-1');
    expect(generator.latestPlanId.value).toBe(22);

    await generator.startWorkout();

    expect(routerPush).toHaveBeenLastCalledWith({
      name: 'WorkoutSession',
      query: { planId: '22' }
    });
  });
});
