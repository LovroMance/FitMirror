import dayjs from 'dayjs';
import { computed, nextTick, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import { syncPlansForUser } from '@/composables/plan/usePlanSync';
import { useAuthStore } from '@/store/auth';
import { planSyncStateRepository, plansRepository, workoutRecordsRepository } from '@/repositories';
import type { PlanEntity } from '@/types/local-db';
import type { PlanExercise, PlanHistoryFilter, PlanHistoryItemView, TrainingPlan } from '@/types/plan';
import type { PageState } from '@/types/ui';
import { buildPlanUsageMap, decoratePlanHistoryItems, filterPlanHistoryItems, sortPlanHistoryItems } from '@/utils/plan-history-usage';

const isValidExercise = (value: unknown): value is PlanExercise => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const item = value as Partial<PlanExercise>;
  return (
    typeof item.name === 'string' &&
    item.name.trim().length > 0 &&
    typeof item.instruction === 'string' &&
    item.instruction.trim().length > 0 &&
    (typeof item.reps === 'string' || typeof item.durationSeconds === 'number') &&
    typeof item.restSeconds === 'number' &&
    Number.isFinite(item.restSeconds)
  );
};

const isValidPlan = (value: unknown): value is TrainingPlan => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<TrainingPlan>;
  return (
    typeof candidate.title === 'string' &&
    candidate.title.trim().length > 0 &&
    typeof candidate.durationMinutes === 'number' &&
    Number.isFinite(candidate.durationMinutes) &&
    candidate.durationMinutes > 0 &&
    (candidate.level === 'beginner' || candidate.level === 'intermediate') &&
    typeof candidate.summary === 'string' &&
    Array.isArray(candidate.exercises) &&
    candidate.exercises.every((exercise) => isValidExercise(exercise))
  );
};

const toHistoryItem = (entity: PlanEntity): PlanHistoryItemView => {
  const plan = entity.planJson;

  if (!isValidPlan(plan) || !entity.id) {
    return {
      id: entity.id ?? -1,
      clientPlanId: entity.clientPlanId,
      goalText: entity.goalText,
      createdAt: entity.createdAt,
      title: '计划数据异常',
      durationMinutes: 0,
      level: 'beginner',
      summary: '该计划数据异常，暂时无法展示详情。',
      exercises: [],
      exerciseCount: 0,
      isValid: false,
      usedWorkoutCount: 0,
      lastUsedAt: null,
      usageBadge: null
    };
  }

  return {
    id: entity.id,
    clientPlanId: entity.clientPlanId,
    goalText: entity.goalText,
    createdAt: entity.createdAt,
    title: plan.title,
    durationMinutes: plan.durationMinutes,
    level: plan.level,
    summary: plan.summary,
    exercises: plan.exercises,
    exerciseCount: plan.exercises.length,
    isValid: true,
    usedWorkoutCount: 0,
    lastUsedAt: null,
    usageBadge: null
  };
};

export const usePlanHistory = () => {
  const router = useRouter();
  const route = useRoute();
  const authStore = useAuthStore();

  const pageState = ref<PageState>('idle');
  const errorMessage = ref('暂时无法读取历史计划，请稍后重试。');
  const items = ref<PlanHistoryItemView[]>([]);
  const expandedPlanId = ref<number | null>(null);
  const deletingPlanId = ref<number | null>(null);
  const highlightedPlanId = ref<number | null>(null);
  const selectedFilter = ref<PlanHistoryFilter>('all');

  const filterOptions: Array<{ value: PlanHistoryFilter; label: string }> = [
    { value: 'all', label: '全部计划' },
    { value: 'used', label: '已用于训练' },
    { value: 'unused', label: '未用于训练' }
  ];

  const hasPlans = computed(() => items.value.length > 0);
  const filteredItems = computed(() => filterPlanHistoryItems(items.value, selectedFilter.value));

  const resolveUserId = (): number | null => {
    const userId = authStore.currentUser?.id ?? null;
    if (!userId) {
      ElMessage.error('登录状态失效，请重新登录');
      return null;
    }

    return userId;
  };

  const formatCreatedAt = (value: string): string => {
    const parsed = dayjs(value);
    if (!parsed.isValid()) {
      return '时间未知';
    }

    return parsed.format('YYYY.MM.DD HH:mm');
  };

  const levelLabel = (value: PlanHistoryItemView['level']): string => {
    return value === 'intermediate' ? '进阶级' : '入门级';
  };

  const usageSummary = (item: PlanHistoryItemView): string => {
    if (item.usedWorkoutCount === 0) {
      return '尚未用于训练';
    }

    const lastUsed = item.lastUsedAt ? dayjs(item.lastUsedAt).format('YYYY.MM.DD') : '时间未知';
    const prefix = item.usageBadge === '最近使用' ? '最近使用' : '已用于训练';

    return `${prefix} · ${lastUsed} · 累计 ${item.usedWorkoutCount} 次`;
  };

  const resolveTargetPlanId = (): number | null => {
    const raw = Array.isArray(route.query.planId) ? route.query.planId[0] : route.query.planId;
    const planId = Number(raw);

    return Number.isFinite(planId) && planId > 0 ? planId : null;
  };

  const scrollToPlanCard = async (planId: number): Promise<void> => {
    await nextTick();

    if (typeof document === 'undefined') {
      return;
    }

    document.getElementById(`plan-history-card-${planId}`)?.scrollIntoView({
      block: 'center',
      behavior: 'smooth'
    });
  };

  const filterIncludesItem = (filter: PlanHistoryFilter, item: PlanHistoryItemView): boolean => {
    if (filter === 'used') {
      return item.usedWorkoutCount > 0;
    }

    if (filter === 'unused') {
      return item.usedWorkoutCount === 0;
    }

    return true;
  };

  const resolveFilterForItem = (item: PlanHistoryItemView): PlanHistoryFilter => {
    return item.usedWorkoutCount > 0 ? 'used' : 'unused';
  };

  const setExpandedFallback = (): void => {
    if (!filteredItems.value.some((item) => item.id === expandedPlanId.value)) {
      expandedPlanId.value = filteredItems.value[0]?.id ?? null;
    }
  };

  const loadHistory = async (): Promise<void> => {
    const userId = resolveUserId();
    if (!userId) {
      return;
    }

    if (!hasPlans.value) {
      pageState.value = 'loading';
    }

    try {
      await syncPlansForUser(userId).catch(() => {
        ElMessage.warning('云端计划同步失败，已先展示本地历史');
      });
      const [loaded, workoutRecords] = await Promise.all([
        plansRepository.listPlansByUser(userId),
        workoutRecordsRepository.listRecordsByUser(userId)
      ]);
      const usageMap = buildPlanUsageMap(workoutRecords);
      items.value = sortPlanHistoryItems(
        decoratePlanHistoryItems(
          loaded
            .map((entity) => toHistoryItem(entity))
            .filter((item) => Number.isFinite(item.id) && item.id > 0),
          usageMap
        )
      );

      const targetPlanId = resolveTargetPlanId();
      const targetItem = targetPlanId ? items.value.find((item) => item.id === targetPlanId) ?? null : null;

      if (targetItem && !filterIncludesItem(selectedFilter.value, targetItem)) {
        selectedFilter.value = resolveFilterForItem(targetItem);
      }

      if (targetItem) {
        expandedPlanId.value = targetPlanId;
        highlightedPlanId.value = targetPlanId;
        await scrollToPlanCard(targetPlanId);
      } else {
        highlightedPlanId.value = null;
      }

      if (!targetItem) {
        setExpandedFallback();
      }

      pageState.value = items.value.length > 0 ? 'ready' : 'empty';
      errorMessage.value = '';
    } catch {
      if (hasPlans.value) {
        pageState.value = 'ready';
        ElMessage.warning('刷新失败，已保留上次可用历史计划');
        return;
      }

      pageState.value = 'error';
      errorMessage.value = '暂时无法读取历史计划，请稍后重试。';
      ElMessage.error('读取历史计划失败，请稍后重试');
    }
  };

  const toggleDetail = (planId: number): void => {
    expandedPlanId.value = expandedPlanId.value === planId ? null : planId;
  };

  const setFilter = (value: PlanHistoryFilter): void => {
    selectedFilter.value = value;
    setExpandedFallback();
  };

  const startWorkout = async (planId: number, isValid: boolean): Promise<void> => {
    if (!isValid) {
      ElMessage.warning('该计划数据异常，暂时无法开始训练');
      return;
    }

    await router.push({
      name: 'WorkoutSession',
      query: { planId: String(planId) }
    });
  };

  const reusePlan = async (planId: number, isValid: boolean): Promise<void> => {
    if (!isValid) {
      ElMessage.warning('该计划数据异常，暂时无法复用到计划页');
      return;
    }

    await router.push({
      name: 'PlanGenerator',
      query: { planId: String(planId) }
    });
  };

  const deletePlan = async (planId: number): Promise<void> => {
    const userId = resolveUserId();
    if (!userId || deletingPlanId.value) {
      return;
    }

    try {
      await ElMessageBox.confirm('删除后无法恢复，这条历史计划将从本地记录中移除。', '删除历史计划', {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning'
      });
    } catch {
      return;
    }

    deletingPlanId.value = planId;

    try {
      const targetPlan = await plansRepository.getPlanById(userId, planId);
      await plansRepository.deletePlan(userId, planId);
      if (targetPlan) {
        await planSyncStateRepository.markPlanDeleted(userId, targetPlan.clientPlanId);
      }
      await syncPlansForUser(userId).catch(() => {
        ElMessage.warning('本地历史已删除，云端同步稍后重试');
      });
      if (expandedPlanId.value === planId) {
        expandedPlanId.value = null;
      }

      await loadHistory();
      ElMessage.success('历史计划已删除');
    } catch {
      ElMessage.error('删除历史计划失败，请稍后重试');
    } finally {
      deletingPlanId.value = null;
    }
  };

  const goToPlanGenerator = async (): Promise<void> => {
    await router.push({ name: 'PlanGenerator' });
  };

  const goHome = async (): Promise<void> => {
    await router.push({ name: 'Home' });
  };

  onMounted(async () => {
    await loadHistory();
  });

  return {
    deletePlan,
    deletingPlanId,
    errorMessage,
    expandedPlanId,
    filteredItems,
    filterOptions,
    formatCreatedAt,
    goHome,
    goToPlanGenerator,
    highlightedPlanId,
    items,
    levelLabel,
    loadHistory,
    pageState,
    reusePlan,
    selectedFilter,
    startWorkout,
    setFilter,
    toggleDetail,
    usageSummary
  };
};
