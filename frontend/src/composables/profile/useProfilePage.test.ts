import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  routerPush,
  messageSuccess,
  messageError,
  confirmMock,
  listPlansByUserMock,
  listRecordsByUserMock,
  getSettingsByUserMock,
  upsertSettingsMock,
  listPendingDeletedPlanIdsMock,
  clearAuthMock
} = vi.hoisted(() => ({
  routerPush: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  confirmMock: vi.fn(),
  listPlansByUserMock: vi.fn(),
  listRecordsByUserMock: vi.fn(),
  getSettingsByUserMock: vi.fn(),
  upsertSettingsMock: vi.fn(),
  listPendingDeletedPlanIdsMock: vi.fn(),
  clearAuthMock: vi.fn()
}));

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>();
  return {
    ...actual,
    onMounted: vi.fn()
  };
});

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush
  })
}));

vi.mock('element-plus', () => ({
  ElMessage: {
    success: messageSuccess,
    error: messageError
  },
  ElMessageBox: {
    confirm: confirmMock
  }
}));

vi.mock('@/repositories', () => ({
  plansRepository: {
    listPlansByUser: listPlansByUserMock
  },
  workoutRecordsRepository: {
    listRecordsByUser: listRecordsByUserMock
  },
  settingsRepository: {
    getSettingsByUser: getSettingsByUserMock,
    upsertSettings: upsertSettingsMock
  },
  planSyncStateRepository: {
    listPendingDeletedPlanIds: listPendingDeletedPlanIdsMock
  }
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    currentUser: {
      id: 7,
      username: 'tester',
      email: 'tester@example.com'
    },
    clearAuth: clearAuthMock
  })
}));

import { useProfilePage } from './useProfilePage';

describe('useProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPlansByUserMock.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    listRecordsByUserMock.mockResolvedValue([
      { id: 1, completed: true },
      { id: 2, completed: false },
      { id: 3, completed: true }
    ]);
    getSettingsByUserMock.mockResolvedValue({
      userId: 7,
      theme: 'light',
      unit: 'metric',
      updatedAt: '2026-04-05T00:00:00.000Z'
    });
    listPendingDeletedPlanIdsMock.mockResolvedValue([]);
    upsertSettingsMock.mockImplementation(async (payload) => payload);
    confirmMock.mockResolvedValue(undefined);
  });

  it('loads profile summary on mount', async () => {
    const profile = useProfilePage();
    await profile.loadProfileSummary();

    expect(profile.stats.value).toEqual({
      savedPlans: 2,
      workoutRecords: 3,
      completedWorkouts: 2
    });
    expect(profile.syncSummary.value).toContain('已启用');
    expect(profile.settings.value?.theme).toBe('light');
  });

  it('updates theme preference', async () => {
    const profile = useProfilePage();
    await profile.loadProfileSummary();

    await profile.handleThemeChange('dark');

    expect(upsertSettingsMock).toHaveBeenCalled();
    expect(profile.settings.value?.theme).toBe('dark');
    expect(messageSuccess).toHaveBeenCalledWith('偏好已更新');
  });

  it('logs out after confirmation', async () => {
    const profile = useProfilePage();
    await profile.loadProfileSummary();

    await profile.handleLogout();

    expect(clearAuthMock).toHaveBeenCalled();
    expect(routerPush).toHaveBeenCalledWith({ name: 'Login' });
  });
});
