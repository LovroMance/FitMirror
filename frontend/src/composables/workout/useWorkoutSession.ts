import dayjs from 'dayjs';
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import { syncWorkoutRecordsForUser } from '@/composables/workout/useWorkoutRecordSync';
import { plansRepository, workoutRecordsRepository } from '@/repositories';
import { useAuthStore } from '@/store/auth';
import type { TrainingPlan } from '@/types/plan';
import type { PageState } from '@/types/ui';

type SessionExerciseMode = 'reps' | 'time';

interface WorkoutSessionExerciseDraft {
  name: string;
  instruction: string;
  restSeconds: number;
  mode: SessionExerciseMode;
  setCount: number;
  repsPerSet: number;
  durationSeconds: number;
  completedSets: number;
}

const DEFAULT_REP_SET_COUNT = 4;
const DEFAULT_TIME_SET_COUNT = 3;
const DEFAULT_REPS_PER_SET = 8;
const DEFAULT_DURATION_SECONDS = 40;

const clampPositiveInteger = (value: number, fallback: number): number => {
  const normalized = Math.round(Number(value));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return fallback;
  }

  return normalized;
};

const parseReps = (reps?: string): number => {
  const match = reps?.match(/\d+/);
  if (!match) {
    return DEFAULT_REPS_PER_SET;
  }

  return clampPositiveInteger(Number(match[0]), DEFAULT_REPS_PER_SET);
};

const createSessionExerciseDraft = (exercise: TrainingPlan['exercises'][number]): WorkoutSessionExerciseDraft => {
  const isTimed = typeof exercise.durationSeconds === 'number' && exercise.durationSeconds > 0;
  return {
    name: exercise.name,
    instruction: exercise.instruction,
    restSeconds: clampPositiveInteger(exercise.restSeconds, 20),
    mode: isTimed ? 'time' : 'reps',
    setCount: isTimed ? DEFAULT_TIME_SET_COUNT : DEFAULT_REP_SET_COUNT,
    repsPerSet: parseReps(exercise.reps),
    durationSeconds: clampPositiveInteger(exercise.durationSeconds ?? DEFAULT_DURATION_SECONDS, DEFAULT_DURATION_SECONDS),
    completedSets: 0
  };
};

export const useWorkoutSession = () => {
  const router = useRouter();
  const route = useRoute();
  const authStore = useAuthStore();

  const sessionState = ref<PageState>('idle');
  const sessionError = ref('当前训练计划不可用，请返回计划页重新生成。');
  const plan = ref<TrainingPlan | null>(null);
  const latestPlanId = ref<number | null>(null);
  const sessionExercises = ref<WorkoutSessionExerciseDraft[]>([]);
  const started = ref(false);
  const saving = ref(false);
  const currentExerciseIndex = ref(0);
  const currentSetIndex = ref(0);
  const sessionStartedAt = ref<number | null>(null);

  const completedExercises = computed(() => sessionExercises.value.filter((exercise) => exercise.completedSets >= exercise.setCount).length);
  const totalSets = computed(() => sessionExercises.value.reduce((sum, exercise) => sum + exercise.setCount, 0));
  const completedSets = computed(() =>
    sessionExercises.value.reduce((sum, exercise) => sum + Math.min(exercise.completedSets, exercise.setCount), 0)
  );
  const currentExercise = computed(() => {
    if (sessionExercises.value.length === 0) {
      return null;
    }

    return sessionExercises.value[currentExerciseIndex.value] ?? null;
  });
  const isLastExercise = computed(() => {
    if (sessionExercises.value.length === 0) {
      return false;
    }

    return currentExerciseIndex.value >= sessionExercises.value.length - 1;
  });
  const currentSetLabel = computed(() => {
    if (!currentExercise.value) {
      return '第 0 / 0 组';
    }

    return `第 ${Math.min(currentSetIndex.value + 1, currentExercise.value.setCount)} / ${currentExercise.value.setCount} 组`;
  });
  const currentExerciseVolumeLabel = computed(() => {
    if (!currentExercise.value) {
      return '';
    }

    return currentExercise.value.mode === 'time'
      ? `${currentExercise.value.setCount} 组 x ${currentExercise.value.durationSeconds} 秒`
      : `${currentExercise.value.setCount} 组 x ${currentExercise.value.repsPerSet} 次`;
  });
  const isLastSetOfExercise = computed(() => {
    if (!currentExercise.value) {
      return false;
    }

    return currentSetIndex.value >= currentExercise.value.setCount - 1;
  });
  const primaryActionLabel = computed(() => {
    if (!currentExercise.value) {
      return '开始训练';
    }

    if (!isLastSetOfExercise.value) {
      return '完成本组';
    }

    return isLastExercise.value ? '完成训练' : '下一个动作';
  });

  const formatExerciseVolume = (exercise: WorkoutSessionExerciseDraft): string =>
    exercise.mode === 'time'
      ? `${exercise.setCount} 组 x ${exercise.durationSeconds} 秒`
      : `${exercise.setCount} 组 x ${exercise.repsPerSet} 次`;

  const updateExerciseDraftValue = (
    index: number,
    key: 'setCount' | 'repsPerSet' | 'durationSeconds',
    value: number
  ): void => {
    const target = sessionExercises.value[index];
    if (!target) {
      return;
    }

    const fallback =
      key === 'setCount'
        ? target.mode === 'time'
          ? DEFAULT_TIME_SET_COUNT
          : DEFAULT_REP_SET_COUNT
        : key === 'repsPerSet'
          ? DEFAULT_REPS_PER_SET
          : DEFAULT_DURATION_SECONDS;
    const nextValue = clampPositiveInteger(value, fallback);
    target[key] = nextValue;

    if (key === 'setCount') {
      target.completedSets = Math.min(target.completedSets, target.setCount);
      if (index === currentExerciseIndex.value) {
        currentSetIndex.value = Math.min(currentSetIndex.value, target.setCount - 1);
      }
    }
  };

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
      sessionExercises.value = targetPlan.planJson.exercises.map((exercise) => createSessionExerciseDraft(exercise));
      latestPlanId.value = targetPlan.id ?? planId;
      sessionState.value = 'ready';
      sessionError.value = '';
    } catch (error) {
      sessionState.value = 'error';
      sessionError.value = error instanceof Error ? error.message : '训练计划读取失败，请稍后重试。';
    }
  };

  const startSession = (): void => {
    if (!plan.value || sessionExercises.value.length === 0) {
      return;
    }

    sessionExercises.value = sessionExercises.value.map((exercise) => ({
      ...exercise,
      completedSets: 0
    }));
    started.value = true;
    currentExerciseIndex.value = 0;
    currentSetIndex.value = 0;
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
      await syncWorkoutRecordsForUser(userId).catch(() => {
        ElMessage.warning('本地记录已保存，云端同步稍后重试');
      });

      ElMessage.success('训练已完成，记录已写入热图');
      await router.push({
        name: 'WorkoutLog',
        query: {
          completedDate: dayjs().format('YYYY-MM-DD'),
          ...(latestPlanId.value ? { completedPlanId: String(latestPlanId.value) } : {})
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '训练记录写入失败，请稍后重试';
      ElMessage.error(message);
    } finally {
      saving.value = false;
    }
  };

  const advanceSession = async (): Promise<void> => {
    const activeExercise = currentExercise.value;
    if (!plan.value || !activeExercise || saving.value) {
      return;
    }

    activeExercise.completedSets = Math.min(activeExercise.completedSets + 1, activeExercise.setCount);

    if (!isLastSetOfExercise.value) {
      currentSetIndex.value += 1;
      return;
    }

    if (isLastExercise.value) {
      await finishSession();
      return;
    }

    currentExerciseIndex.value += 1;
    currentSetIndex.value = 0;
  };

  onMounted(async () => {
    await loadSession();
  });

  return {
    advanceSession,
    completedExercises,
    completedSets,
    currentExercise,
    currentExerciseIndex,
    currentExerciseVolumeLabel,
    currentSetIndex,
    currentSetLabel,
    formatExerciseVolume,
    goBackToPlans,
    isLastSetOfExercise,
    isLastExercise,
    plan,
    primaryActionLabel,
    saving,
    sessionExercises,
    sessionError,
    sessionState,
    startSession,
    started,
    totalSets,
    updateExerciseDraftValue
  };
};
