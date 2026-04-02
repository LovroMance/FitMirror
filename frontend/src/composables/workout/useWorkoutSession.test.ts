import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mountedCallbacks, routerPush, routeMock, plansRepositoryMocks, workoutRecordsRepositoryMocks, syncWorkoutRecordsForUser } = vi.hoisted(() => ({
  mountedCallbacks: [] as Array<() => unknown>,
  routerPush: vi.fn(),
  routeMock: {
    query: {
      planId: '11'
    }
  },
  plansRepositoryMocks: {
    getPlanById: vi.fn()
  },
  workoutRecordsRepositoryMocks: {
    createRecord: vi.fn()
  },
  syncWorkoutRecordsForUser: vi.fn()
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

vi.mock('@/repositories', () => ({
  plansRepository: plansRepositoryMocks,
  workoutRecordsRepository: workoutRecordsRepositoryMocks
}));
vi.mock('@/composables/workout/useWorkoutRecordSync', () => ({
  syncWorkoutRecordsForUser
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
  }
}));

import { useWorkoutSession } from './useWorkoutSession';

describe('useWorkoutSession', () => {
  beforeEach(() => {
    mountedCallbacks.length = 0;
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    syncWorkoutRecordsForUser.mockResolvedValue(undefined);
  });

  it('writes the linked plan id into the completed workout record', async () => {
    plansRepositoryMocks.getPlanById.mockResolvedValue({
      id: 11,
      userId: 7,
      clientPlanId: 'plan-11',
      goalText: '晨练核心',
      createdAt: '2026-04-02T08:00:00.000Z',
      updatedAt: '2026-04-02T08:00:00.000Z',
      planJson: {
        title: '晨练核心',
        level: 'beginner',
        durationMinutes: 16,
        summary: '短时核心训练',
        exercises: [
          {
            name: '卷腹',
            reps: '15 次',
            restSeconds: 20,
            instruction: '保持节奏稳定'
          }
        ]
      }
    });
    workoutRecordsRepositoryMocks.createRecord.mockResolvedValue({
      id: 1
    });

    const session = useWorkoutSession();
    await mountedCallbacks[0]?.();

    session.startSession();
    await session.advanceSession();

    expect(workoutRecordsRepositoryMocks.createRecord).toHaveBeenCalledWith({
      userId: 7,
      date: '2026-04-02',
      duration: 16,
      completed: true,
      planId: 11
    });
    expect(syncWorkoutRecordsForUser).toHaveBeenCalledWith(7);
    expect(routerPush).toHaveBeenCalledWith({
      name: 'WorkoutLog',
      query: { completedDate: '2026-04-02' }
    });
  });
});
