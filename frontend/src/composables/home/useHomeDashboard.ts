import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { syncWorkoutRecordsForUser } from '@/composables/workout/useWorkoutRecordSync';
import { useAuthStore } from '@/store/auth';
import { workoutRecordsRepository } from '@/repositories';
import { homeRecommendations } from '@/config/home';
import { buildDailyHeatmapPoints, calculateWorkoutSummary, getRecentDateRange } from '@/utils/workout-heatmap';

export const useHomeDashboard = () => {
  const router = useRouter();
  const authStore = useAuthStore();

  const planPrompt = ref('');
  const summary = ref({ trainingDays: 0, totalDuration: 0, streakDays: 0 });

  const resolveUserId = (): number | null => {
    const userId = authStore.currentUser?.id ?? null;
    if (!userId) {
      ElMessage.error('登录状态失效，请重新登录');
      return null;
    }

    return userId;
  };

  const loadSummary = async (): Promise<void> => {
    const userId = resolveUserId();
    if (!userId) {
      return;
    }

    try {
      await syncWorkoutRecordsForUser(userId).catch(() => undefined);
      const { startDate, endDate, dates } = getRecentDateRange(42);
      const records = await workoutRecordsRepository.listRecordsByDateRange(userId, startDate, endDate);
      const points = buildDailyHeatmapPoints(records, dates);
      summary.value = calculateWorkoutSummary(points);
    } catch {
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
    if (!goal) {
      ElMessage.warning('先输入一个训练目标吧');
      return;
    }

    await safePush('PlanGenerator', { goal, autoGenerate: '1' });
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
    await loadSummary();
  });

  return {
    handleGeneratePlan,
    handleOpenLibrary,
    handleOpenNutrition,
    handleOpenPlanHistory,
    homeRecommendations,
    planPrompt,
    summary
  };
};
