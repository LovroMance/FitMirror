import dayjs from 'dayjs';
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { workoutRecordsRepository } from '@/repositories';
import type { WorkoutRecordEntity } from '@/types/local-db';
import type { PageState } from '@/types/ui';
import type { DailyHeatmapPoint, WorkoutPeriod } from '@/types/workout';
import {
  buildDailyHeatmapPoints,
  buildHeatmapRows,
  calculateWorkoutTrendSummary,
  calculateWorkoutSummary,
  getDateRangeByPeriod
} from '@/utils/workout-heatmap';

const MOCK_WRITE_GAP_MS = 900;

export const useWorkoutLog = () => {
  const router = useRouter();
  const authStore = useAuthStore();

  const records = ref<WorkoutRecordEntity[]>([]);
  const dailyPoints = ref<DailyHeatmapPoint[]>([]);
  const detailVisible = ref(false);
  const selectedDate = ref('');
  const dayDetails = ref<WorkoutRecordEntity[]>([]);
  const detailLoading = ref(false);
  const detailError = ref('');
  const detailCacheByDate = ref<Record<string, WorkoutRecordEntity[]>>({});
  const isMockWriting = ref(false);
  const lastMockWriteAt = ref(0);
  const detailRequestToken = ref(0);
  const recordsState = ref<PageState>('idle');
  const recordsError = ref('暂时无法读取训练记录，请稍后重试。');
  const selectedPeriod = ref<WorkoutPeriod>('week');

  const summary = computed(() => calculateWorkoutSummary(dailyPoints.value));
  const trendSummary = computed(() => calculateWorkoutTrendSummary(dailyPoints.value));
  const heatmapRows = computed(() => buildHeatmapRows(dailyPoints.value));
  const periodTitle = computed(() => (selectedPeriod.value === 'month' ? '近 30 天' : '近 6 周'));
  const dateRangeLabel = computed(() => {
    if (dailyPoints.value.length === 0) {
      return getDateRangeByPeriod(selectedPeriod.value).label;
    }

    const start = dayjs(dailyPoints.value[0].date).format('MM.DD');
    const end = dayjs(dailyPoints.value[dailyPoints.value.length - 1].date).format('MM.DD');
    return `${start}-${end}`;
  });

  const resolveUserId = (): number | null => {
    const userId = authStore.currentUser?.id ?? null;
    if (!userId) {
      ElMessage.error('登录状态失效，请重新登录');
      return null;
    }

    return userId;
  };

  const refreshRecords = async (): Promise<void> => {
    const userId = resolveUserId();
    if (!userId) {
      return;
    }

    if (dailyPoints.value.length === 0) {
      recordsState.value = 'loading';
    }

    try {
      const { startDate, endDate, dates } = getDateRangeByPeriod(selectedPeriod.value);
      const loaded = await workoutRecordsRepository.listRecordsByDateRange(userId, startDate, endDate);
      records.value = loaded;
      dailyPoints.value = buildDailyHeatmapPoints(loaded, dates);
      recordsState.value = summary.value.trainingDays > 0 ? 'ready' : 'empty';
      recordsError.value = '';
    } catch {
      if (dailyPoints.value.length > 0) {
        recordsState.value = 'ready';
        ElMessage.warning('刷新失败，已保留上次可用记录');
        return;
      }

      recordsState.value = 'error';
      recordsError.value = '暂时无法读取训练记录，请稍后重试。';
      ElMessage.error('读取训练记录失败，请稍后重试');
    }
  };

  const mockAddRecord = async (duration: number): Promise<void> => {
    if (!Number.isFinite(duration) || duration <= 0) {
      ElMessage.warning('训练时长异常，请稍后重试');
      return;
    }

    const now = Date.now();
    if (isMockWriting.value || now - lastMockWriteAt.value < MOCK_WRITE_GAP_MS) {
      ElMessage.warning('请稍后再试，避免重复写入');
      return;
    }

    const userId = resolveUserId();
    if (!userId) {
      return;
    }

    isMockWriting.value = true;

    try {
      await workoutRecordsRepository.createRecord({
        userId,
        date: dayjs().format('YYYY-MM-DD'),
        duration,
        completed: true
      });

      await refreshRecords();
      lastMockWriteAt.value = Date.now();
      ElMessage.success(`已写入 ${duration} 分钟训练记录`);
    } catch {
      ElMessage.error('写入训练记录失败，请稍后重试');
    } finally {
      isMockWriting.value = false;
    }
  };

  const openDayDetail = async (date: string): Promise<void> => {
    if (!dayjs(date, 'YYYY-MM-DD', true).isValid()) {
      ElMessage.warning('日期数据异常，请刷新后重试');
      return;
    }

    const userId = resolveUserId();
    if (!userId) {
      return;
    }

    selectedDate.value = date;
    detailVisible.value = true;
    detailLoading.value = true;
    detailError.value = '';

    const requestToken = detailRequestToken.value + 1;
    detailRequestToken.value = requestToken;

    const cached = detailCacheByDate.value[date];
    if (cached) {
      dayDetails.value = cached;
    }

    try {
      const details = await workoutRecordsRepository.listRecordsByDay(userId, date);
      if (requestToken !== detailRequestToken.value) {
        return;
      }

      dayDetails.value = details;
      detailCacheByDate.value[date] = details;
      detailError.value = '';
    } catch {
      if (requestToken !== detailRequestToken.value) {
        return;
      }

      detailError.value = '请检查本地数据状态后重试。';
      if (!cached) {
        dayDetails.value = [];
      }
      ElMessage.error('读取当天详情失败，请稍后重试');
    } finally {
      if (requestToken === detailRequestToken.value) {
        detailLoading.value = false;
      }
    }
  };

  const retryDayDetail = async (): Promise<void> => {
    if (!selectedDate.value) {
      return;
    }

    await openDayDetail(selectedDate.value);
  };

  const goHome = async (): Promise<void> => {
    await router.push({ name: 'Home' });
  };

  const goToPlanGenerator = async (): Promise<void> => {
    await router.push({ name: 'PlanGenerator' });
  };

  const changePeriod = async (period: WorkoutPeriod): Promise<void> => {
    if (selectedPeriod.value === period) {
      return;
    }

    selectedPeriod.value = period;
    await refreshRecords();
  };

  onMounted(async () => {
    await refreshRecords();
  });

  return {
    dateRangeLabel,
    dayDetails,
    detailError,
    detailLoading,
    detailVisible,
    goHome,
    goToPlanGenerator,
    heatmapRows,
    isMockWriting,
    mockAddRecord,
    openDayDetail,
    periodTitle,
    recordsError,
    recordsState,
    refreshRecords,
    retryDayDetail,
    selectedPeriod,
    selectedDate,
    summary,
    trendSummary,
    changePeriod
  };
};
