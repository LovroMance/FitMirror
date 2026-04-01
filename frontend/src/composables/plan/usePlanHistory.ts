import dayjs from 'dayjs';
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { plansRepository } from '@/repositories';
import type { PlanEntity } from '@/types/local-db';
import type { PlanExercise, PlanHistoryItemView, TrainingPlan } from '@/types/plan';
import type { PageState } from '@/types/ui';

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
      goalText: entity.goalText,
      createdAt: entity.createdAt,
      title: '计划数据异常',
      durationMinutes: 0,
      level: 'beginner',
      summary: '该计划数据异常，暂时无法展示详情。',
      exercises: [],
      exerciseCount: 0,
      isValid: false
    };
  }

  return {
    id: entity.id,
    goalText: entity.goalText,
    createdAt: entity.createdAt,
    title: plan.title,
    durationMinutes: plan.durationMinutes,
    level: plan.level,
    summary: plan.summary,
    exercises: plan.exercises,
    exerciseCount: plan.exercises.length,
    isValid: true
  };
};

export const usePlanHistory = () => {
  const router = useRouter();
  const authStore = useAuthStore();

  const pageState = ref<PageState>('idle');
  const errorMessage = ref('暂时无法读取历史计划，请稍后重试。');
  const items = ref<PlanHistoryItemView[]>([]);
  const expandedPlanId = ref<number | null>(null);
  const deletingPlanId = ref<number | null>(null);

  const hasPlans = computed(() => items.value.length > 0);

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

  const loadHistory = async (): Promise<void> => {
    const userId = resolveUserId();
    if (!userId) {
      return;
    }

    if (!hasPlans.value) {
      pageState.value = 'loading';
    }

    try {
      const loaded = await plansRepository.listPlansByUser(userId);
      items.value = loaded
        .map((entity) => toHistoryItem(entity))
        .filter((item) => Number.isFinite(item.id) && item.id > 0);

      if (!items.value.some((item) => item.id === expandedPlanId.value)) {
        expandedPlanId.value = items.value[0]?.id ?? null;
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
      await plansRepository.deletePlan(userId, planId);
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
    formatCreatedAt,
    goHome,
    goToPlanGenerator,
    items,
    levelLabel,
    loadHistory,
    pageState,
    reusePlan,
    startWorkout,
    toggleDetail
  };
};
