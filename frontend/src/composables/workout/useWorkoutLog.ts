import dayjs from 'dayjs';
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import { syncWorkoutRecordsForUser } from '@/composables/workout/useWorkoutRecordSync';
import { useAuthStore } from '@/store/auth';
import { plansRepository, workoutRecordsRepository } from '@/repositories';
import type { WorkoutRecordEntity } from '@/types/local-db';
import type { PageState } from '@/types/ui';
import type {
  DailyHeatmapPoint,
  WorkoutDayDetailView,
  WorkoutLogCompletionFilter,
  WorkoutLogDurationFilter,
  WorkoutLogRecordListItem,
  WorkoutPeriod
} from '@/types/workout';
import {
  buildDailyHeatmapPoints,
  buildHeatmapRows,
  calculateWorkoutTrendSummary,
  calculateWorkoutSummary,
  getDateRangeByPeriod
} from '@/utils/workout-heatmap';
import { buildWorkoutDayDetailViews } from '@/utils/workout-record-details';

const JUST_COMPLETED_BANNER_TITLE = '刚完成训练';
const DEFAULT_FILTER_RANGE: string[] = [];

export const useWorkoutLog = () => {
  const router = useRouter();
  const route = useRoute();
  const authStore = useAuthStore();

  const records = ref<WorkoutRecordEntity[]>([]);
  const dailyPoints = ref<DailyHeatmapPoint[]>([]);
  const detailVisible = ref(false);
  const selectedDate = ref('');
  const dayDetails = ref<WorkoutDayDetailView[]>([]);
  const detailLoading = ref(false);
  const detailError = ref('');
  const editingRecordId = ref<string | null>(null);
  const editingDuration = ref(10);
  const editingCompleted = ref(true);
  const detailSaving = ref(false);
  const detailCacheByDate = ref<Record<string, WorkoutDayDetailView[]>>({});
  const linkedPlanSummaryById = ref<Record<number, { title: string; goalText: string }>>({});
  const detailRequestToken = ref(0);
  const hasHandledCompletedDate = ref(false);
  const recordsState = ref<PageState>('idle');
  const recordsError = ref('暂时无法读取训练记录，请稍后重试。');
  const selectedPeriod = ref<WorkoutPeriod>('week');
  const searchKeyword = ref('');
  const selectedFilterDateRange = ref<string[]>(DEFAULT_FILTER_RANGE);
  const selectedCompletionFilter = ref<WorkoutLogCompletionFilter>('all');
  const selectedDurationFilter = ref<WorkoutLogDurationFilter>('all');

  const summary = computed(() => calculateWorkoutSummary(dailyPoints.value));
  const trendSummary = computed(() => calculateWorkoutTrendSummary(dailyPoints.value));
  const heatmapRows = computed(() => buildHeatmapRows(dailyPoints.value));
  const filteredRecordItems = computed<WorkoutLogRecordListItem[]>(() => {
    const keyword = searchKeyword.value.trim().toLowerCase();
    const [startDate, endDate] = selectedFilterDateRange.value;

    return [...records.value]
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date < b.date ? 1 : -1;
        }

        return a.updatedAt < b.updatedAt ? 1 : -1;
      })
      .map((record) => {
        const planId = typeof record.planId === 'number' && record.planId > 0 ? record.planId : null;
        const linkedPlan = planId ? linkedPlanSummaryById.value[planId] : null;
        const sourceLabel = planId ? '计划训练' : '手动记录';
        return {
          clientRecordId: record.clientRecordId,
          date: record.date,
          duration: record.duration,
          completed: record.completed,
          planId,
          title: linkedPlan?.title || (planId ? '关联计划已删除' : '手动训练记录'),
          subtitle: linkedPlan?.goalText || (planId ? '原计划已不可查看' : '未关联训练计划'),
          goalText: linkedPlan?.goalText ?? null,
          sourceLabel
        };
      })
      .filter((record) => {
        if (startDate && record.date < startDate) {
          return false;
        }

        if (endDate && record.date > endDate) {
          return false;
        }

        if (selectedCompletionFilter.value === 'completed' && !record.completed) {
          return false;
        }

        if (selectedCompletionFilter.value === 'incomplete' && record.completed) {
          return false;
        }

        if (selectedDurationFilter.value === 'short' && record.duration > 15) {
          return false;
        }

        if (selectedDurationFilter.value === 'medium' && (record.duration < 16 || record.duration > 30)) {
          return false;
        }

        if (selectedDurationFilter.value === 'long' && record.duration < 31) {
          return false;
        }

        if (!keyword) {
          return true;
        }

        const haystack = [record.title, record.subtitle, record.sourceLabel, record.date].join(' ').toLowerCase();
        return haystack.includes(keyword);
      });
  });
  const filteredRecordsSummary = computed(() => ({
    count: filteredRecordItems.value.length,
    totalDuration: filteredRecordItems.value.reduce((sum, record) => sum + record.duration, 0)
  }));
  const completedDateTarget = computed(() => resolveCompletedDateTarget());
  const completedPlanTarget = computed(() => resolveCompletedPlanTarget());
  const completionBanner = computed(() => {
    const completedDate = completedDateTarget.value;
    if (!completedDate) {
      return {
        visible: false,
        title: JUST_COMPLETED_BANNER_TITLE,
        description: '',
        actionLabel: '查看当天详情'
      };
    }

    const hasRecord = records.value.some((record) => record.date === completedDate);
    if (!hasRecord) {
      return {
        visible: true,
        title: JUST_COMPLETED_BANNER_TITLE,
        description: `${completedDate} 的训练记录还在同步中，稍后可再次打开当天详情确认结果。`,
        actionLabel: '重新加载'
      };
    }

    return {
      visible: true,
      title: JUST_COMPLETED_BANNER_TITLE,
      description: `${completedDate} 的训练结果已回到记录页，下面会优先展示刚完成的内容。`,
      actionLabel: '查看当天详情'
    };
  });
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
      await syncWorkoutRecordsForUser(userId).catch(() => {
        ElMessage.warning('云端记录同步失败，已先展示本地数据');
      });
      const loaded = await workoutRecordsRepository.listRecordsByUser(userId);
      records.value = loaded;
      const planIds = [
        ...new Set(loaded.map((record) => record.planId).filter((planId): planId is number => typeof planId === 'number' && planId > 0))
      ];
      const linkedPlans = await Promise.all(planIds.map((planId) => plansRepository.getPlanById(userId, planId)));
      linkedPlanSummaryById.value = Object.fromEntries(
        linkedPlans
          .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan))
          .map((plan) => [plan.id as number, { title: plan.planJson.title, goalText: plan.goalText }])
      );
      const { startDate, endDate, dates } = getDateRangeByPeriod(selectedPeriod.value);
      const periodRecords = loaded.filter((record) => record.date >= startDate && record.date <= endDate);
      dailyPoints.value = buildDailyHeatmapPoints(periodRecords, dates);
      detailCacheByDate.value = {};
      const handledCompletedDate = await openCompletedDateDetailIfNeeded();
      if (!handledCompletedDate && selectedDate.value) {
        await openDayDetail(selectedDate.value);
      }
      recordsState.value = loaded.length > 0 ? 'ready' : 'empty';
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
      const planIds = [
        ...new Set(details.map((record) => record.planId).filter((planId): planId is number => typeof planId === 'number' && planId > 0))
      ];
      const linkedPlans = await Promise.all(planIds.map((planId) => plansRepository.getPlanById(userId, planId)));
      const plansById = new Map(linkedPlans.filter((plan): plan is NonNullable<typeof plan> => Boolean(plan)).map((plan) => [plan.id as number, plan]));
      const detailViews = markJustCompletedRecord(prioritizeCompletedPlanRecord(buildWorkoutDayDetailViews(details, plansById)));
      if (requestToken !== detailRequestToken.value) {
        return;
      }

      dayDetails.value = detailViews;
      detailCacheByDate.value[date] = detailViews;
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

  const startEditingRecord = (detail: WorkoutDayDetailView): void => {
    editingRecordId.value = detail.clientRecordId;
    editingDuration.value = detail.duration;
    editingCompleted.value = detail.completed;
  };

  const cancelEditingRecord = (): void => {
    editingRecordId.value = null;
    editingDuration.value = 10;
    editingCompleted.value = true;
  };

  const saveEditedRecord = async (): Promise<void> => {
    if (!editingRecordId.value || detailSaving.value) {
      return;
    }

    if (!Number.isFinite(editingDuration.value) || editingDuration.value <= 0) {
      ElMessage.warning('请输入有效的训练时长');
      return;
    }

    const userId = resolveUserId();
    if (!userId) {
      return;
    }

    detailSaving.value = true;

    try {
      const updated = await workoutRecordsRepository.updateRecordByClientId(userId, editingRecordId.value, {
        duration: Math.round(editingDuration.value),
        completed: editingCompleted.value
      });

      if (!updated) {
        throw new Error('未找到要编辑的训练记录');
      }

      await syncWorkoutRecordsForUser(userId).catch(() => {
        ElMessage.warning('本地训练记录已更新，云端同步稍后重试');
      });
      await refreshRecords();
      cancelEditingRecord();
      ElMessage.success('训练记录已更新');
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新训练记录失败，请稍后重试';
      ElMessage.error(message);
    } finally {
      detailSaving.value = false;
    }
  };

  const deleteRecord = async (detail: WorkoutDayDetailView): Promise<void> => {
    if (detailSaving.value) {
      return;
    }

    const userId = resolveUserId();
    if (!userId) {
      return;
    }

    try {
      await ElMessageBox.confirm('删除后这条训练记录将从热图和当天详情中移除。', '删除训练记录？', {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning'
      });
    } catch {
      return;
    }

    detailSaving.value = true;

    try {
      const deleted = await workoutRecordsRepository.deleteRecordByClientId(userId, detail.clientRecordId);
      if (!deleted) {
        throw new Error('未找到要删除的训练记录');
      }

      await syncWorkoutRecordsForUser(userId).catch(() => {
        ElMessage.warning('本地训练记录已删除，云端同步稍后重试');
      });
      if (editingRecordId.value === detail.clientRecordId) {
        cancelEditingRecord();
      }
      await refreshRecords();
      ElMessage.success('训练记录已删除');
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除训练记录失败，请稍后重试';
      ElMessage.error(message);
    } finally {
      detailSaving.value = false;
    }
  };

  const resolveCompletedDateTarget = (): string | null => {
    const raw = Array.isArray(route.query.completedDate) ? route.query.completedDate[0] : route.query.completedDate;
    if (typeof raw !== 'string') {
      return null;
    }

    return dayjs(raw, 'YYYY-MM-DD', true).isValid() ? raw : null;
  };

  const resolveCompletedPlanTarget = (): number | null => {
    const raw = Array.isArray(route.query.completedPlanId) ? route.query.completedPlanId[0] : route.query.completedPlanId;
    const planId = Number(raw);
    return Number.isFinite(planId) && planId > 0 ? planId : null;
  };

  const prioritizeCompletedPlanRecord = (details: WorkoutDayDetailView[]): WorkoutDayDetailView[] => {
    const completedPlanId = completedPlanTarget.value;
    if (!completedPlanId || details.length < 2) {
      return details;
    }

    const targetIndex = details.findIndex((detail) => detail.planId === completedPlanId);
    if (targetIndex <= 0) {
      return details;
    }

    const prioritized = [...details];
    const [targetDetail] = prioritized.splice(targetIndex, 1);
    prioritized.unshift(targetDetail);
    return prioritized;
  };

  const markJustCompletedRecord = (details: WorkoutDayDetailView[]): WorkoutDayDetailView[] => {
    const completedDate = completedDateTarget.value;
    if (!completedDate || selectedDate.value !== completedDate) {
      return details.map((detail) => ({ ...detail, isJustCompleted: false }));
    }

    const completedPlanId = completedPlanTarget.value;
    let highlightedIndex = -1;
    if (completedPlanId) {
      highlightedIndex = details.findIndex((detail) => detail.planId === completedPlanId);
    } else if (details.length === 1) {
      highlightedIndex = 0;
    }

    return details.map((detail, index) => ({
      ...detail,
      isJustCompleted: index === highlightedIndex
    }));
  };

  const openCompletedDateDetailIfNeeded = async (): Promise<boolean> => {
    if (hasHandledCompletedDate.value) {
      return false;
    }

    const completedDate = resolveCompletedDateTarget();
    if (!completedDate) {
      return false;
    }

    hasHandledCompletedDate.value = true;
    selectedDate.value = completedDate;

    const hasRecord = records.value.some((record) => record.date === completedDate);
    if (!hasRecord) {
      ElMessage.warning('本次训练记录正在同步，请稍后重试查看当天详情');
      return true;
    }

    ElMessage.success('本次训练已写入今日热图，已为你展开当天详情');
    await openDayDetail(completedDate);
    return true;
  };

  const openRelatedPlan = async (planId: number | null): Promise<void> => {
    if (!planId || !Number.isFinite(planId) || planId <= 0) {
      ElMessage.warning('这条记录没有关联可查看的训练计划');
      return;
    }

    await router.push({
      name: 'PlanHistory',
      query: { planId: String(planId) }
    });
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

  const handleCompletionBannerAction = async (): Promise<void> => {
    const completedDate = completedDateTarget.value;
    if (!completedDate) {
      return;
    }

    const hasRecord = records.value.some((record) => record.date === completedDate);
    if (!hasRecord) {
      await refreshRecords();
      return;
    }

    await openDayDetail(completedDate);
  };

  const setCompletionFilter = (filter: WorkoutLogCompletionFilter): void => {
    selectedCompletionFilter.value = filter;
  };

  const setDurationFilter = (filter: WorkoutLogDurationFilter): void => {
    selectedDurationFilter.value = filter;
  };

  const clearRecordFilters = (): void => {
    searchKeyword.value = '';
    selectedFilterDateRange.value = DEFAULT_FILTER_RANGE;
    selectedCompletionFilter.value = 'all';
    selectedDurationFilter.value = 'all';
  };

  return {
    clearRecordFilters,
    dateRangeLabel,
    completionBanner,
    completedDateTarget,
    deleteRecord,
    dayDetails,
    detailError,
    detailLoading,
    detailSaving,
    detailVisible,
    editingCompleted,
    editingDuration,
    editingRecordId,
    filteredRecordItems,
    filteredRecordsSummary,
    goHome,
    goToPlanGenerator,
    heatmapRows,
    handleCompletionBannerAction,
    openDayDetail,
    openRelatedPlan,
    periodTitle,
    recordsError,
    recordsState,
    refreshRecords,
    resolveCompletedDateTarget,
    resolveCompletedPlanTarget,
    retryDayDetail,
    saveEditedRecord,
    searchKeyword,
    selectedCompletionFilter,
    selectedDurationFilter,
    selectedFilterDateRange,
    selectedPeriod,
    selectedDate,
    setCompletionFilter,
    setDurationFilter,
    summary,
    startEditingRecord,
    trendSummary,
    changePeriod,
    cancelEditingRecord
  };
};
