import dayjs from 'dayjs';
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import { plansRepository, workoutRecordsRepository } from '@/repositories';
import { useAuthStore } from '@/store/auth';
import type { TrainingPlan } from '@/types/plan';
import type { PageState } from '@/types/ui';

export const useWorkoutSession = () => {
  const router = useRouter();
  const route = useRoute();
  const authStore = useAuthStore();

  const sessionState = ref<PageState>('idle');
  const sessionError = ref('当前训练计划不可用，请返回计划页重新生成。');
  const plan = ref<TrainingPlan | null>(null);
  const latestPlanId = ref<number | null>(null);
  const started = ref(false);
  const saving = ref(false);
  const currentExerciseIndex = ref(0);
  const sessionStartedAt = ref<number | null>(null);

  const completedExercises = computed(() => (started.value ? currentExerciseIndex.value : 0));
  const currentExercise = computed(() => {
    if (!plan.value) {
      return null;
    }

    return plan.value.exercises[currentExerciseIndex.value] ?? null;
  });
  const isLastExercise = computed(() => {
    if (!plan.value) {
      return false;
    }

    return currentExerciseIndex.value >= plan.value.exercises.length - 1;
  });

  const resolveUserId = (): number | null => {
    const userId = authStore.currentUser?.id ?? null;
    if (!userId) {
      ElMessage.error('登录状态失效，请重新登录');
      return null;
    }

    return userId;
  };

  const goBackToPlans = async (): Promise<void> => {
    if (latestPlanId.value) {
      await router.push({ name: 'PlanGenerator' });
      return;
    }

    await router.push({ name: 'Home' });
  };

  const resolvePlanId = (): number | null => {
    const raw = Array.isArray(route.query.planId) ? route.query.planId[0] : route.query.planId;
    const planId = Number(raw);
    return Number.isFinite(planId) && planId > 0 ? planId : null;
  };

  const loadSession = async (): Promise<void> => {
    const userId = resolveUserId();
    const planId = resolvePlanId();

    if (!userId || !planId) {
      sessionState.value = 'error';
      sessionError.value = '缺少可用的训练计划，请先返回计划页生成或恢复计划。';
      return;
    }

    sessionState.value = 'loading';

    try {
      const targetPlan = await plansRepository.getPlanById(userId, planId);
      if (!targetPlan) {
        throw new Error('训练计划不存在或已被删除');
      }

      plan.value = targetPlan.planJson;
      latestPlanId.value = targetPlan.id ?? planId;
      sessionState.value = 'ready';
      sessionError.value = '';
    } catch (error) {
      sessionState.value = 'error';
      sessionError.value = error instanceof Error ? error.message : '训练计划读取失败，请稍后重试。';
    }
  };

  const startSession = (): void => {
    if (!plan.value) {
      return;
    }

    started.value = true;
    currentExerciseIndex.value = 0;
    sessionStartedAt.value = Date.now();
  };

  const finishSession = async (): Promise<void> => {
    const userId = resolveUserId();
    if (!userId || !plan.value) {
      return;
    }

    saving.value = true;

    try {
      const measuredMinutes =
        sessionStartedAt.value !== null ? Math.round((Date.now() - sessionStartedAt.value) / 60000) : 0;
      const duration = measuredMinutes > 0 ? measuredMinutes : plan.value.durationMinutes;

      await workoutRecordsRepository.createRecord({
        userId,
        date: dayjs().format('YYYY-MM-DD'),
        duration,
        completed: true,
        ...(latestPlanId.value ? { planId: latestPlanId.value } : {})
      });

      ElMessage.success('训练已完成，记录已写入热图');
      await router.push({ name: 'WorkoutLog' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '训练记录写入失败，请稍后重试';
      ElMessage.error(message);
    } finally {
      saving.value = false;
    }
  };

  const advanceSession = async (): Promise<void> => {
    if (!plan.value || saving.value) {
      return;
    }

    if (isLastExercise.value) {
      await finishSession();
      return;
    }

    currentExerciseIndex.value += 1;
  };

  onMounted(async () => {
    await loadSession();
  });

  return {
    advanceSession,
    completedExercises,
    currentExercise,
    currentExerciseIndex,
    goBackToPlans,
    isLastExercise,
    plan,
    saving,
    sessionError,
    sessionState,
    startSession,
    started
  };
};
