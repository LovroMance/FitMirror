import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { workoutRecordsRepository } from '@/repositories';
import { homeRecommendations, homeTabs } from '@/config/home';
import type { PageState } from '@/types/ui';
import {
  buildDailyHeatmapPoints,
  buildHeatmapColumnsFromRows,
  buildHeatmapRows,
  calculateWorkoutSummary,
  getRecentDateRange
} from '@/utils/workout-heatmap';

export const useHomeDashboard = () => {
  const router = useRouter();
  const route = useRoute();
  const authStore = useAuthStore();

  const planPrompt = ref('');
  const homeHeatmapColumns = ref<Array<Array<0 | 1 | 2 | 3 | 4>>>([]);
  const summary = ref({ trainingDays: 0, totalDuration: 0, streakDays: 0 });
  const heatmapState = ref<PageState>('idle');
  const heatmapError = ref('暂时无法读取训练记录，请稍后重试。');

  const activeRouteName = computed(() => route.name);

  const resolveUserId = (): number | null => {
    const userId = authStore.currentUser?.id ?? null;
    if (!userId) {
      ElMessage.error('登录状态失效，请重新登录');
      return null;
    }

    return userId;
  };

  const loadHeatmap = async (): Promise<void> => {
    const userId = resolveUserId();
    if (!userId) {
      return;
    }

    if (homeHeatmapColumns.value.length === 0) {
      heatmapState.value = 'loading';
    }

    try {
      const { startDate, endDate, dates } = getRecentDateRange(42);
      const records = await workoutRecordsRepository.listRecordsByDateRange(userId, startDate, endDate);
      const points = buildDailyHeatmapPoints(records, dates);
      const rows = buildHeatmapRows(points);
      homeHeatmapColumns.value = buildHeatmapColumnsFromRows(rows);
      summary.value = calculateWorkoutSummary(points);
      heatmapState.value = summary.value.trainingDays > 0 ? 'ready' : 'empty';
      heatmapError.value = '';
    } catch (error) {
      const message = error instanceof Error ? error.message : '读取打卡记录失败';
      heatmapError.value = message;
      if (homeHeatmapColumns.value.length > 0) {
        heatmapState.value = 'ready';
        ElMessage.warning('热图更新失败，已保留上次可用数据');
        return;
      }

      heatmapState.value = 'error';
      ElMessage.error('读取训练记录失败，请重试');
    }
  };

  const safePush = async (routeName: string, query?: Record<string, string>): Promise<void> => {
    try {
      await router.push({ name: routeName, query });
    } catch {
      ElMessage.error('页面跳转失败，请稍后重试');
    }
  };

  const handleGeneratePlan = async (): Promise<void> => {
    const goal = planPrompt.value.trim();
    if (!goal && heatmapState.value !== 'empty') {
      ElMessage.warning('先输入一个训练目标吧');
      return;
    }

    const query = goal ? { goal } : undefined;
    await safePush('PlanGenerator', query);
  };

  const handleOpenLibrary = async (): Promise<void> => {
    await safePush('Exercises');
  };

  const handleOpenPlanHistory = async (): Promise<void> => {
    await safePush('PlanHistory');
  };

  const isTabActive = (routeName: string): boolean => activeRouteName.value === routeName;

  const handleTabClick = async (routeName: string): Promise<void> => {
    if (activeRouteName.value === routeName) {
      return;
    }

    await safePush(routeName);
  };

  onMounted(async () => {
    await loadHeatmap();
  });

  return {
    handleGeneratePlan,
    handleOpenLibrary,
    handleOpenPlanHistory,
    handleTabClick,
    heatmapError,
    heatmapState,
    homeHeatmapColumns,
    homeRecommendations,
    homeTabs,
    isTabActive,
    loadHeatmap,
    planPrompt,
    summary
  };
};
