import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { syncWorkoutRecordsForUser } from '@/composables/workout/useWorkoutRecordSync';
import { useAuthStore } from '@/store/auth';
import { workoutRecordsRepository } from '@/repositories';
import { homeRecommendations } from '@/config/home';
import type { PageState } from '@/types/ui';
import type { DailyHeatmapPoint } from '@/types/workout';
import { buildDailyHeatmapPoints, buildHeatmapRows, calculateWorkoutSummary, getRecentDateRange } from '@/utils/workout-heatmap';

const getHomeHeatmapLevelByDuration = (duration: number): 0 | 1 | 2 | 3 | 4 => {
  if (duration <= 0) {
    return 0;
  }

  if (duration >= 60) {
    return 4;
  }

  if (duration >= 40) {
    return 3;
  }

  if (duration >= 20) {
    return 2;
  }

  return 1;
};

const buildHeatmapPointColumnsFromRows = (rows: DailyHeatmapPoint[][]): DailyHeatmapPoint[][] => {
  if (rows.length === 0) {
    return [];
  }

  const columns: DailyHeatmapPoint[][] = Array.from({ length: rows[0].length }, () => []);

  rows.forEach((row) => {
    row.forEach((point, idx) => {
      columns[idx].push({
        ...point,
        intensityLevel: getHomeHeatmapLevelByDuration(point.totalDuration)
      });
    });
  });

  return columns;
};

export const useHomeDashboard = () => {
  const router = useRouter();
  const authStore = useAuthStore();

  const planPrompt = ref('');
  const homeHeatmapColumns = ref<DailyHeatmapPoint[][]>([]);
  const summary = ref({ trainingDays: 0, totalDuration: 0, streakDays: 0 });
  const heatmapState = ref<PageState>('idle');
  const heatmapError = ref('暂时无法读取训练记录，请稍后重试。');

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
      await syncWorkoutRecordsForUser(userId).catch(() => undefined);
      const { startDate, endDate, dates } = getRecentDateRange(42);
      const records = await workoutRecordsRepository.listRecordsByDateRange(userId, startDate, endDate);
      const points = buildDailyHeatmapPoints(records, dates);
      const rows = buildHeatmapRows(points);
      homeHeatmapColumns.value = buildHeatmapPointColumnsFromRows(rows);
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

    const query = goal ? { goal, autoGenerate: '1' } : undefined;
    await safePush('PlanGenerator', query);
  };

  const handleOpenLibrary = async (): Promise<void> => {
    await safePush('Exercises');
  };

  const handleOpenPlanHistory = async (): Promise<void> => {
    await safePush('PlanHistory');
  };

  const handleOpenNutrition = async (): Promise<void> => {
    await safePush('Nutrition');
  };

  onMounted(async () => {
    await loadHeatmap();
  });

  return {
    handleGeneratePlan,
    handleOpenLibrary,
    handleOpenNutrition,
    handleOpenPlanHistory,
    heatmapError,
    heatmapState,
    homeHeatmapColumns,
    homeRecommendations,
    loadHeatmap,
    planPrompt,
    summary
  };
};
