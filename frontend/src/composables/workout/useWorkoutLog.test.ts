import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mountedCallbacks,
  routerPush,
  routeMock,
  plansRepositoryMocks,
  workoutRecordsRepositoryMocks,
  syncWorkoutRecordsForUser,
  messageBoxConfirm,
  messageSuccess,
  messageWarning,
  messageError
} = vi.hoisted(() => ({
  mountedCallbacks: [] as Array<() => unknown>,
  routerPush: vi.fn(),
  routeMock: {
    query: {
      completedDate: '2026-04-02'
    }
  },
  plansRepositoryMocks: {
    getPlanById: vi.fn()
  },
  workoutRecordsRepositoryMocks: {
    listRecordsByUser: vi.fn(),
    listRecordsByDay: vi.fn(),
    updateRecordByClientId: vi.fn(),
    deleteRecordByClientId: vi.fn()
  },
  syncWorkoutRecordsForUser: vi.fn(),
  messageBoxConfirm: vi.fn(),
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
    error: messageError,
    warning: messageWarning,
    success: messageSuccess
  },
  ElMessageBox: {
    confirm: messageBoxConfirm
  }
}));

import { useWorkoutLog } from './useWorkoutLog';

describe('useWorkoutLog', () => {
  beforeEach(() => {
    mountedCallbacks.length = 0;
    vi.clearAllMocks();
    routeMock.query.completedDate = '2026-04-02';
    routeMock.query.completedPlanId = undefined;
    syncWorkoutRecordsForUser.mockResolvedValue(undefined);
    messageBoxConfirm.mockResolvedValue(undefined);
    workoutRecordsRepositoryMocks.listRecordsByUser.mockResolvedValue([]);
    workoutRecordsRepositoryMocks.listRecordsByDay.mockResolvedValue([]);
  });

  it('auto-opens the completed date detail when the workout log is entered from a finished session', async () => {
    workoutRecordsRepositoryMocks.listRecordsByUser.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        clientRecordId: 'rec-1',
        date: '2026-04-02',
        duration: 18,
        completed: true,
        planId: 2,
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:10:00.000Z'
      }
    ]);
    workoutRecordsRepositoryMocks.listRecordsByDay.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        clientRecordId: 'rec-1',
        date: '2026-04-02',
        duration: 18,
        completed: true,
        planId: 2,
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:10:00.000Z'
      }
    ]);
    plansRepositoryMocks.getPlanById.mockResolvedValue({
      id: 2,
      userId: 7,
      clientPlanId: 'plan-2',
      goalText: '核心训练',
      createdAt: '2026-04-02T09:00:00.000Z',
      updatedAt: '2026-04-02T09:00:00.000Z',
      planJson: {
        title: '核心激活',
        level: 'beginner',
        durationMinutes: 18,
        summary: '激活核心',
        exercises: []
      }
    });

    const log = useWorkoutLog();
    await mountedCallbacks[0]?.();

    expect(syncWorkoutRecordsForUser).toHaveBeenCalledWith(7);
    expect(log.selectedDate.value).toBe('2026-04-02');
    expect(log.detailVisible.value).toBe(true);
    expect(log.completionBanner.value.visible).toBe(true);
    expect(log.completionBanner.value.actionLabel).toBe('查看当天详情');
    expect(workoutRecordsRepositoryMocks.listRecordsByDay).toHaveBeenCalledWith(7, '2026-04-02');
    expect(messageSuccess).toHaveBeenCalledWith('本次训练已写入今日热图，已为你展开当天详情');
  });

  it('shows a fallback warning when the completed date has no readable record yet', async () => {
    workoutRecordsRepositoryMocks.listRecordsByUser.mockResolvedValue([]);

    const log = useWorkoutLog();
    await mountedCallbacks[0]?.();

    expect(log.selectedDate.value).toBe('2026-04-02');
    expect(log.detailVisible.value).toBe(false);
    expect(log.completionBanner.value.visible).toBe(true);
    expect(log.completionBanner.value.actionLabel).toBe('重新加载');
    expect(workoutRecordsRepositoryMocks.listRecordsByDay).not.toHaveBeenCalled();
    expect(messageWarning).toHaveBeenCalledWith('本次训练记录正在同步，请稍后重试查看当天详情');
  });

  it('prioritizes the completed plan record when multiple records exist on the same day', async () => {
    routeMock.query.completedPlanId = '2';
    workoutRecordsRepositoryMocks.listRecordsByUser.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        clientRecordId: 'rec-1',
        date: '2026-04-02',
        duration: 12,
        completed: true,
        planId: 1,
        createdAt: '2026-04-02T09:00:00.000Z',
        updatedAt: '2026-04-02T09:10:00.000Z'
      },
      {
        id: 2,
        userId: 7,
        clientRecordId: 'rec-2',
        date: '2026-04-02',
        duration: 18,
        completed: true,
        planId: 2,
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:10:00.000Z'
      }
    ]);
    workoutRecordsRepositoryMocks.listRecordsByDay.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        clientRecordId: 'rec-1',
        date: '2026-04-02',
        duration: 12,
        completed: true,
        planId: 1,
        createdAt: '2026-04-02T09:00:00.000Z',
        updatedAt: '2026-04-02T09:10:00.000Z'
      },
      {
        id: 2,
        userId: 7,
        clientRecordId: 'rec-2',
        date: '2026-04-02',
        duration: 18,
        completed: true,
        planId: 2,
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:10:00.000Z'
      }
    ]);
    plansRepositoryMocks.getPlanById.mockImplementation(async (_userId: number, planId: number) => ({
      id: planId,
      userId: 7,
      clientPlanId: `plan-${planId}`,
      goalText: `目标 ${planId}`,
      createdAt: '2026-04-02T08:00:00.000Z',
      updatedAt: '2026-04-02T08:00:00.000Z',
      planJson: {
        title: `计划 ${planId}`,
        level: 'beginner',
        durationMinutes: 18,
        summary: `摘要 ${planId}`,
        exercises: []
      }
    }));

    const log = useWorkoutLog();
    await mountedCallbacks[0]?.();

    expect(log.dayDetails.value[0]?.planId).toBe(2);
    expect(log.dayDetails.value[0]?.isJustCompleted).toBe(true);
    expect(log.dayDetails.value[1]?.planId).toBe(1);
    expect(log.dayDetails.value[1]?.isJustCompleted).toBe(false);
  });

  it('opens the completed date detail from the banner action when the record already exists', async () => {
    workoutRecordsRepositoryMocks.listRecordsByUser.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        clientRecordId: 'rec-1',
        date: '2026-04-02',
        duration: 18,
        completed: true,
        planId: 2,
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:10:00.000Z'
      }
    ]);
    workoutRecordsRepositoryMocks.listRecordsByDay.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        clientRecordId: 'rec-1',
        date: '2026-04-02',
        duration: 18,
        completed: true,
        planId: 2,
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:10:00.000Z'
      }
    ]);
    plansRepositoryMocks.getPlanById.mockResolvedValue({
      id: 2,
      userId: 7,
      clientPlanId: 'plan-2',
      goalText: '核心训练',
      createdAt: '2026-04-02T09:00:00.000Z',
      updatedAt: '2026-04-02T09:00:00.000Z',
      planJson: {
        title: '核心激活',
        level: 'beginner',
        durationMinutes: 18,
        summary: '激活核心',
        exercises: []
      }
    });

    const log = useWorkoutLog();
    await mountedCallbacks[0]?.();
    workoutRecordsRepositoryMocks.listRecordsByDay.mockClear();

    await log.handleCompletionBannerAction();

    expect(workoutRecordsRepositoryMocks.listRecordsByDay).toHaveBeenCalledWith(7, '2026-04-02');
  });

  it('refreshes records from the banner action when the completed record is still syncing', async () => {
    workoutRecordsRepositoryMocks.listRecordsByUser.mockResolvedValue([]);

    const log = useWorkoutLog();
    await mountedCallbacks[0]?.();
    workoutRecordsRepositoryMocks.listRecordsByUser.mockClear();

    await log.handleCompletionBannerAction();

    expect(workoutRecordsRepositoryMocks.listRecordsByUser).toHaveBeenCalledTimes(1);
  });

  it('updates one day record and refreshes the detail list', async () => {
    workoutRecordsRepositoryMocks.listRecordsByUser.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        clientRecordId: 'rec-1',
        date: '2026-04-02',
        duration: 18,
        completed: true,
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:10:00.000Z'
      }
    ]);
    workoutRecordsRepositoryMocks.listRecordsByDay.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        clientRecordId: 'rec-1',
        date: '2026-04-02',
        duration: 18,
        completed: true,
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:10:00.000Z'
      }
    ]);
    workoutRecordsRepositoryMocks.updateRecordByClientId.mockResolvedValue({
      id: 1,
      userId: 7,
      clientRecordId: 'rec-1',
      date: '2026-04-02',
      duration: 25,
      completed: false,
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:20:00.000Z'
    });

    const log = useWorkoutLog();
    await mountedCallbacks[0]?.();

    log.startEditingRecord(log.dayDetails.value[0]!);
    log.editingDuration.value = 25;
    log.editingCompleted.value = false;

    await log.saveEditedRecord();

    expect(workoutRecordsRepositoryMocks.updateRecordByClientId).toHaveBeenCalledWith(7, 'rec-1', {
      duration: 25,
      completed: false
    });
    expect(syncWorkoutRecordsForUser).toHaveBeenCalledWith(7);
    expect(messageSuccess).toHaveBeenCalledWith('训练记录已更新');
    expect(log.editingRecordId.value).toBe(null);
  });

  it('deletes one day record and refreshes the heatmap state', async () => {
    workoutRecordsRepositoryMocks.listRecordsByUser
      .mockResolvedValueOnce([
        {
          id: 1,
          userId: 7,
          clientRecordId: 'rec-1',
          date: '2026-04-02',
          duration: 18,
          completed: true,
          createdAt: '2026-04-02T10:00:00.000Z',
          updatedAt: '2026-04-02T10:10:00.000Z'
        }
      ])
      .mockResolvedValueOnce([]);
    workoutRecordsRepositoryMocks.listRecordsByDay
      .mockResolvedValueOnce([
        {
          id: 1,
          userId: 7,
          clientRecordId: 'rec-1',
          date: '2026-04-02',
          duration: 18,
          completed: true,
          createdAt: '2026-04-02T10:00:00.000Z',
          updatedAt: '2026-04-02T10:10:00.000Z'
        }
      ])
      .mockResolvedValueOnce([]);
    workoutRecordsRepositoryMocks.deleteRecordByClientId.mockResolvedValue(true);

    const log = useWorkoutLog();
    await mountedCallbacks[0]?.();

    await log.deleteRecord(log.dayDetails.value[0]!);

    expect(messageBoxConfirm).toHaveBeenCalled();
    expect(workoutRecordsRepositoryMocks.deleteRecordByClientId).toHaveBeenCalledWith(7, 'rec-1');
    expect(syncWorkoutRecordsForUser).toHaveBeenCalledWith(7);
    expect(messageSuccess).toHaveBeenCalledWith('训练记录已删除');
  });

  it('filters records by title keyword, completion state, duration and date range', async () => {
    routeMock.query.completedDate = undefined;
    workoutRecordsRepositoryMocks.listRecordsByUser.mockResolvedValue([
      {
        id: 1,
        userId: 7,
        clientRecordId: 'rec-1',
        date: '2026-04-02',
        duration: 12,
        completed: true,
        planId: 2,
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:10:00.000Z'
      },
      {
        id: 2,
        userId: 7,
        clientRecordId: 'rec-2',
        date: '2026-03-28',
        duration: 35,
        completed: false,
        createdAt: '2026-03-28T10:00:00.000Z',
        updatedAt: '2026-03-28T10:10:00.000Z'
      }
    ]);
    plansRepositoryMocks.getPlanById.mockResolvedValue({
      id: 2,
      userId: 7,
      clientPlanId: 'plan-2',
      goalText: '核心强化',
      createdAt: '2026-04-02T09:00:00.000Z',
      updatedAt: '2026-04-02T09:00:00.000Z',
      planJson: {
        title: '核心激活',
        level: 'beginner',
        durationMinutes: 18,
        summary: '激活核心',
        exercises: []
      }
    });

    const log = useWorkoutLog();
    await mountedCallbacks[0]?.();

    expect(log.filteredRecordItems.value).toHaveLength(2);

    log.searchKeyword.value = '核心';
    expect(log.filteredRecordItems.value.map((item) => item.clientRecordId)).toEqual(['rec-1']);

    log.searchKeyword.value = '';
    log.setCompletionFilter('incomplete');
    expect(log.filteredRecordItems.value.map((item) => item.clientRecordId)).toEqual(['rec-2']);

    log.setCompletionFilter('all');
    log.setDurationFilter('long');
    expect(log.filteredRecordItems.value.map((item) => item.clientRecordId)).toEqual(['rec-2']);

    log.setDurationFilter('all');
    log.selectedFilterDateRange.value = ['2026-04-01', '2026-04-03'];
    expect(log.filteredRecordItems.value.map((item) => item.clientRecordId)).toEqual(['rec-1']);
  });
});
