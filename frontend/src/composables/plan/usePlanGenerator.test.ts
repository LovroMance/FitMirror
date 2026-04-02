import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExerciseItem } from '@/types/exercise';
import type { TrainingPlan } from '@/types/plan';

const {
  mountedCallbacks,
  routeLeaveGuards,
  routerPush,
  routerReplace,
  routeMock,
  generatePlanStream,
  generatePlanApiWithSource,
  fetchExercises,
  syncPlansForUser,
  plansRepositoryMocks,
  messageBoxConfirm,
  messageSuccess,
  messageWarning,
  messageError
} = vi.hoisted(() => ({
  mountedCallbacks: [] as Array<() => unknown>,
  routeLeaveGuards: [] as Array<(to?: unknown, from?: unknown) => unknown>,
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  routeMock: {
    query: {}
  },
  generatePlanStream: vi.fn(),
  generatePlanApiWithSource: vi.fn(),
  fetchExercises: vi.fn(),
  syncPlansForUser: vi.fn(),
  plansRepositoryMocks: {
    saveLatestPlan: vi.fn(),
    loadLatestPlan: vi.fn(),
    getPlanById: vi.fn(),
    getPlanByClientPlanId: vi.fn(),
    updatePlanById: vi.fn(),
    deletePlan: vi.fn()
  },
  messageBoxConfirm: vi.fn(),
  messageSuccess: vi.fn(),
  messageWarning: vi.fn(),
  messageError: vi.fn()
}));

class SessionStorageMock {
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

  clear(): void {
    this.store.clear();
  }
}

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue');
  return {
    ...actual,
    onMounted: (callback: () => unknown) => {
      mountedCallbacks.push(callback);
    },
    onBeforeUnmount: vi.fn()
  };
});

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace
  }),
  useRoute: () => routeMock,
  onBeforeRouteLeave: (guard: (to?: unknown, from?: unknown) => unknown) => {
    routeLeaveGuards.push(guard);
  }
}));

vi.mock('@/api/plans', () => ({
  generatePlanStream,
  generatePlanApiWithSource
}));

vi.mock('@/api/exercises', () => ({
  fetchExercises
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
  },
  ElMessageBox: {
    confirm: messageBoxConfirm
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
    },
    {
      name: '登山跑',
      durationSeconds: 40,
      restSeconds: 20,
      instruction: '保持核心收紧。'
    }
  ]
};

const replacementExercise: ExerciseItem = {
  id: 'dead-bug',
  name: '死虫式',
  bodyPart: 'core',
  level: 'beginner',
  equipment: 'none',
  durationMinutes: 8,
  sets: 3,
  reps: '左右各 12 次',
  description: '适合核心稳定训练。',
  instructions: ['缓慢伸展四肢并保持核心稳定。'],
  tips: ['保持下背贴地。'],
  tags: ['core']
};

describe('usePlanGenerator', () => {
  beforeEach(() => {
    mountedCallbacks.length = 0;
    routeLeaveGuards.length = 0;
    vi.clearAllMocks();
    vi.stubGlobal('sessionStorage', new SessionStorageMock());
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    routeMock.query = {};
    generatePlanStream.mockResolvedValue({
      plan: samplePlan,
      source: 'template'
    });
    fetchExercises.mockResolvedValue([replacementExercise]);
    syncPlansForUser.mockResolvedValue(undefined);
    messageBoxConfirm.mockResolvedValue(undefined);
    plansRepositoryMocks.loadLatestPlan.mockResolvedValue(null);
    plansRepositoryMocks.getPlanById.mockResolvedValue({
      id: 22,
      userId: 7,
      clientPlanId: 'plan-client-1',
      goalText: '核心训练',
      planJson: samplePlan,
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:05:00.000Z'
    });
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
    plansRepositoryMocks.updatePlanById.mockImplementation(async (_userId, planId, params) => ({
      id: planId,
      userId: 7,
      clientPlanId: 'plan-client-1',
      goalText: params.goalText ?? '核心训练',
      planJson: params.plan ?? samplePlan,
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:06:00.000Z'
    }));
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

  it('supports lightweight editing and saves back to the same plan id', async () => {
    plansRepositoryMocks.loadLatestPlan.mockResolvedValue({
      id: 22,
      userId: 7,
      clientPlanId: 'plan-client-1',
      goalText: '核心训练',
      planJson: samplePlan,
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:05:00.000Z'
    });

    const generator = usePlanGenerator();
    await mountedCallbacks[0]?.();

    generator.enterEditMode();
    generator.updateDraftTitle('15分钟核心训练');
    generator.updateDraftDuration(15);
    generator.moveExerciseDown(0);
    generator.removeExercise(1);

    await generator.saveEditedPlan();

    expect(plansRepositoryMocks.updatePlanById).toHaveBeenCalledWith(
      7,
      22,
      expect.objectContaining({
        goalText: '核心训练',
        plan: expect.objectContaining({
          title: '15分钟核心训练',
          durationMinutes: 15,
          exercises: [expect.objectContaining({ name: '登山跑' })]
        })
      })
    );
    expect(generator.latestPlanId.value).toBe(22);
    expect(generator.isEditingPlan.value).toBe(false);
    expect(generator.plan.value).toMatchObject({
      title: '15分钟核心训练',
      durationMinutes: 15,
      exercises: [{ name: '登山跑' }]
    });
  });

  it('starts the exercise replacement flow with a clear route payload', async () => {
    plansRepositoryMocks.loadLatestPlan.mockResolvedValue({
      id: 22,
      userId: 7,
      clientPlanId: 'plan-client-1',
      goalText: '核心训练',
      planJson: samplePlan,
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:05:00.000Z'
    });

    const generator = usePlanGenerator();
    await mountedCallbacks[0]?.();

    generator.enterEditMode();
    await generator.startExerciseReplacement(1);

    expect(routerPush).toHaveBeenCalledWith({
      name: 'Exercises',
      query: {
        q: '登山跑',
        mode: 'replacePlanExercise',
        planId: '22',
        replaceExerciseIndex: '1'
      }
    });
    expect(sessionStorage.getItem('fitmirror_plan_editing_session')).toContain('"latestPlanId":22');
  });

  it('restores the editing draft and applies the selected replacement exercise from route query', async () => {
    sessionStorage.setItem(
      'fitmirror_plan_editing_session',
      JSON.stringify({
        latestPlanId: 22,
        goalText: '核心训练',
        editablePlanDraft: {
          title: samplePlan.title,
          level: samplePlan.level,
          durationMinutes: samplePlan.durationMinutes,
          summary: samplePlan.summary,
          exercises: samplePlan.exercises
        }
      })
    );
    routeMock.query = {
      planId: '22',
      replaceExerciseId: 'dead-bug',
      replaceExerciseIndex: '1'
    };

    const generator = usePlanGenerator();
    await mountedCallbacks[0]?.();

    expect(fetchExercises).toHaveBeenCalled();
    expect(generator.isEditingPlan.value).toBe(true);
    expect(generator.editablePlanDraft.value?.exercises[1]).toMatchObject({
      name: '死虫式',
      reps: '左右各 12 次',
      restSeconds: 20
    });
    expect(routerReplace).toHaveBeenCalledWith({
      name: 'PlanGenerator',
      query: {
        planId: '22'
      }
    });
  });

  it('blocks workout start while there are unsaved edits', async () => {
    plansRepositoryMocks.loadLatestPlan.mockResolvedValue({
      id: 22,
      userId: 7,
      clientPlanId: 'plan-client-1',
      goalText: '核心训练',
      planJson: samplePlan,
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:05:00.000Z'
    });

    const generator = usePlanGenerator();
    await mountedCallbacks[0]?.();

    generator.enterEditMode();
    await generator.startWorkout();

    expect(routerPush).not.toHaveBeenCalledWith({
      name: 'WorkoutSession',
      query: { planId: '22' }
    });
    expect(messageWarning).toHaveBeenCalledWith('请先保存当前编辑内容，再开始训练');
  });

  it('asks for confirmation before cancelling unsaved edits', async () => {
    plansRepositoryMocks.loadLatestPlan.mockResolvedValue({
      id: 22,
      userId: 7,
      clientPlanId: 'plan-client-1',
      goalText: '核心训练',
      planJson: samplePlan,
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:05:00.000Z'
    });

    const generator = usePlanGenerator();
    await mountedCallbacks[0]?.();

    generator.enterEditMode();
    generator.updateDraftTitle('临时草稿');
    await generator.cancelEdit();

    expect(messageBoxConfirm).toHaveBeenCalledWith(
      '当前编辑内容尚未保存，离开后会丢失这些修改。',
      '放弃未保存变更？',
      expect.any(Object)
    );
    expect(generator.isEditingPlan.value).toBe(false);
  });

  it('blocks route leave when unsaved edits are not confirmed', async () => {
    plansRepositoryMocks.loadLatestPlan.mockResolvedValue({
      id: 22,
      userId: 7,
      clientPlanId: 'plan-client-1',
      goalText: '核心训练',
      planJson: samplePlan,
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:05:00.000Z'
    });
    messageBoxConfirm.mockRejectedValue(new Error('cancel'));

    const generator = usePlanGenerator();
    await mountedCallbacks[0]?.();

    generator.enterEditMode();
    generator.updateDraftTitle('未保存草稿');

    const guardResult = await routeLeaveGuards[0]?.();

    expect(guardResult).toBe(false);
  });
});
