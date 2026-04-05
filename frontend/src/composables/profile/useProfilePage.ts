import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import {
  planSyncStateRepository,
  plansRepository,
  settingsRepository,
  workoutRecordsRepository
} from '@/repositories';
import { useAuthStore } from '@/store/auth';
import type { UserSettingsEntity } from '@/types/local-db';

interface ProfileStats {
  savedPlans: number;
  workoutRecords: number;
  completedWorkouts: number;
}

const buildDefaultSettings = (userId: number): UserSettingsEntity => ({
  userId,
  theme: 'light',
  unit: 'metric',
  updatedAt: new Date().toISOString()
});

export const useProfilePage = () => {
  const router = useRouter();
  const authStore = useAuthStore();

  const currentUser = computed(() => authStore.currentUser);
  const stats = ref<ProfileStats>({
    savedPlans: 0,
    workoutRecords: 0,
    completedWorkouts: 0
  });
  const settings = ref<UserSettingsEntity | null>(null);
  const syncSummary = ref('正在读取本地同步状态...');
  const loading = ref(false);

  const quickActions = [
    {
      title: '训练记录',
      description: '查看最近打卡、热图和趋势摘要。',
      actionLabel: '查看记录',
      action: async () => {
        await router.push({ name: 'WorkoutLog' });
      }
    },
    {
      title: '历史计划',
      description: '回看最近生成和保存过的训练计划。',
      actionLabel: '查看计划',
      action: async () => {
        await router.push({ name: 'PlanHistory' });
      }
    },
    {
      title: '饮食计划',
      description: '继续生成或调整今天的饮食安排。',
      actionLabel: '去饮食页',
      action: async () => {
        await router.push({ name: 'Nutrition' });
      }
    }
  ];

  const loadProfileSummary = async (): Promise<void> => {
    const userId = currentUser.value?.id;
    if (!userId) {
      syncSummary.value = '未读取到当前登录用户';
      return;
    }

    loading.value = true;

    try {
      const [plans, workoutRecords, userSettings, pendingDeletedPlanIds] = await Promise.all([
        plansRepository.listPlansByUser(userId),
        workoutRecordsRepository.listRecordsByUser(userId),
        settingsRepository.getSettingsByUser(userId),
        planSyncStateRepository.listPendingDeletedPlanIds(userId)
      ]);

      stats.value = {
        savedPlans: plans.length,
        workoutRecords: workoutRecords.length,
        completedWorkouts: workoutRecords.filter((record) => record.completed).length
      };

      settings.value = userSettings ?? buildDefaultSettings(userId);
      syncSummary.value =
        pendingDeletedPlanIds.length > 0
          ? `有 ${pendingDeletedPlanIds.length} 条计划删除记录待同步`
          : '计划与训练记录已启用本地同步整理';
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取个人资料失败';
      syncSummary.value = '个人资料摘要读取失败，请稍后重试';
      ElMessage.error(message);
    } finally {
      loading.value = false;
    }
  };

  const updateSettings = async (updates: Partial<Pick<UserSettingsEntity, 'theme' | 'unit'>>): Promise<void> => {
    const userId = currentUser.value?.id;
    if (!userId) {
      ElMessage.error('未读取到当前登录用户');
      return;
    }

    const nextSettings: UserSettingsEntity = {
      ...(settings.value ?? buildDefaultSettings(userId)),
      ...updates,
      userId,
      updatedAt: new Date().toISOString()
    };

    await settingsRepository.upsertSettings(nextSettings);
    settings.value = nextSettings;
    ElMessage.success('偏好已更新');
  };

  const handleThemeChange = async (theme: UserSettingsEntity['theme']): Promise<void> => {
    if (settings.value?.theme === theme) {
      return;
    }

    await updateSettings({ theme });
  };

  const handleUnitChange = async (unit: UserSettingsEntity['unit']): Promise<void> => {
    if (settings.value?.unit === unit) {
      return;
    }

    await updateSettings({ unit });
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await ElMessageBox.confirm('退出后需要重新登录才能继续同步数据，确定要退出吗？', '退出登录', {
        confirmButtonText: '退出',
        cancelButtonText: '取消',
        type: 'warning'
      });
    } catch {
      return;
    }

    authStore.clearAuth();
    ElMessage.success('已退出登录');
    await router.push({ name: 'Login' });
  };

  onMounted(async () => {
    await loadProfileSummary();
  });

  return {
    currentUser,
    handleLogout,
    handleThemeChange,
    handleUnitChange,
    loadProfileSummary,
    loading,
    quickActions,
    settings,
    stats,
    syncSummary
  };
};
