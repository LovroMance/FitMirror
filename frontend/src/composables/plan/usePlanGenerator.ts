import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { generatePlanApiWithSource, generatePlanStream } from '@/api/plans';
import { useAuthStore } from '@/store/auth';
import type { PlanExercise, PlanSource, PlanStreamEvent, TrainingPlan } from '@/types/plan';
import { plansRepository } from '@/repositories';

export const usePlanGenerator = () => {
  const router = useRouter();
  const route = useRoute();
  const authStore = useAuthStore();

  const goalText = ref('');
  const loading = ref(false);
  const deleting = ref(false);
  const errorMessage = ref('');
  const plan = ref<TrainingPlan | null>(null);
  const latestPlanId = ref<number | null>(null);
  const planSource = ref<PlanSource | null>(null);
  const progressState = ref<PlanStreamEvent['type'] | null>(null);
  const generationRound = ref(0);

  const currentUserId = computed(() => authStore.currentUser?.id ?? null);
  const levelText = computed(() => {
    if (!plan.value) {
      return '未知难度';
    }

    if (plan.value.level === 'beginner') {
      return '入门级';
    }

    if (plan.value.level === 'intermediate') {
      return '进阶级';
    }

    return '未知难度';
  });

  const progressLabel = computed(() => {
    switch (progressState.value) {
      case 'queued':
        return '准备中...';
      case 'llm_start':
        return 'AI 生成中...';
      case 'llm_done':
        return '结果校验中...';
      case 'llm_failed':
        return 'AI 生成失败，正在切换模板...';
      case 'fallback_start':
        return '模板回退中...';
      case 'completed':
        return '已完成';
      default:
        return '生成中...';
    }
  });

  const sourceLabel = computed(() => {
    if (planSource.value === 'deepseek') {
      return 'AI 生成';
    }

    if (planSource.value === 'template') {
      return '模板回退';
    }

    return '本地恢复';
  });

  const sourceTagClass = computed(() => {
    if (planSource.value === 'deepseek') {
      return 'ai';
    }

    if (planSource.value === 'template') {
      return 'fallback';
    }

    return 'restored';
  });

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
      typeof candidate.summary === 'string' &&
      Array.isArray(candidate.exercises) &&
      candidate.exercises.length > 0 &&
      candidate.exercises.every((exercise) => isValidExercise(exercise))
    );
  };

  const resolveCurrentUserId = (): number | null => {
    const userId = currentUserId.value;
    if (!userId) {
      ElMessage.error('登录状态已失效，请重新登录');
      return null;
    }

    return userId;
  };

  const openExerciseLibrary = (keyword = ''): void => {
    const query = keyword ? { q: keyword } : {};
    router.push({ name: 'Exercises', query });
  };

  const goToPlanHistory = async (): Promise<void> => {
    await router.push({ name: 'PlanHistory' });
  };

  const startWorkout = async (): Promise<void> => {
    if (!latestPlanId.value) {
      ElMessage.warning('当前计划尚未保存，请先生成或恢复计划');
      return;
    }

    await router.push({
      name: 'WorkoutSession',
      query: { planId: String(latestPlanId.value) }
    });
  };

  const handleGenerate = async (): Promise<void> => {
    if (loading.value || deleting.value) {
      return;
    }

    const userId = resolveCurrentUserId();
    if (!userId) {
      return;
    }

    const trimmedGoal = goalText.value.trim();
    if (!trimmedGoal) {
      ElMessage.warning('请先输入训练目标');
      return;
    }

    loading.value = true;
    errorMessage.value = '';
    progressState.value = 'queued';
    const currentRound = generationRound.value + 1;
    generationRound.value = currentRound;

    try {
      const streamed = await generatePlanStream(
        trimmedGoal,
        (event) => {
          if (currentRound !== generationRound.value) {
            return;
          }

          progressState.value = event.type;
        },
        { timeoutMs: 12000 }
      );

      if (currentRound !== generationRound.value) {
        return;
      }

      if (!isValidPlan(streamed.plan)) {
        throw new Error('计划数据异常，请重试');
      }

      plan.value = streamed.plan;
      planSource.value = streamed.source ?? null;
    } catch {
      try {
        const fallback = await generatePlanApiWithSource(trimmedGoal);
        if (currentRound !== generationRound.value) {
          return;
        }

        if (!isValidPlan(fallback.plan)) {
          throw new Error('计划数据异常，请重试');
        }

        plan.value = fallback.plan;
        planSource.value = fallback.source ?? 'template';
        progressState.value = 'completed';
        ElMessage.warning('已自动切换到稳定生成通道');
      } catch (error) {
        if (currentRound !== generationRound.value) {
          return;
        }

        const message = error instanceof Error ? error.message : '计划生成失败，请稍后重试';
        errorMessage.value = message;
        ElMessage.error(message);
        loading.value = false;
        return;
      }
    }

    try {
      if (!plan.value) {
        throw new Error('计划生成失败，请稍后重试');
      }

      const persistedPlan = JSON.parse(JSON.stringify(plan.value)) as TrainingPlan;

      const saved = await plansRepository.saveLatestPlan({
        userId,
        goalText: trimmedGoal,
        plan: persistedPlan
      });

      if (currentRound !== generationRound.value) {
        return;
      }

      latestPlanId.value = saved.id ?? null;
      progressState.value = 'completed';
      ElMessage.success('计划已生成并保存');
    } catch (error) {
      if (currentRound !== generationRound.value) {
        return;
      }

      const message = error instanceof Error ? error.message : '计划保存失败，请稍后重试';
      errorMessage.value = message;
      ElMessage.error(message);
    } finally {
      if (currentRound === generationRound.value) {
        loading.value = false;
      }
    }
  };

  const handleDeleteLatest = async (): Promise<void> => {
    if (loading.value || deleting.value) {
      return;
    }

    const userId = resolveCurrentUserId();
    if (!userId) {
      return;
    }

    deleting.value = true;
    errorMessage.value = '';

    try {
      await plansRepository.deletePlan(userId, latestPlanId.value ?? undefined);
      latestPlanId.value = null;
      plan.value = null;
      planSource.value = null;
      ElMessage.success('最近计划已删除');
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败，请稍后重试';
      errorMessage.value = message;
      ElMessage.error(message);
    } finally {
      deleting.value = false;
    }
  };

  const restoreLatestPlan = async (): Promise<void> => {
    const userId = resolveCurrentUserId();
    if (!userId) {
      return;
    }

    try {
      const latest = await plansRepository.loadLatestPlan(userId);
      if (!latest) {
        return;
      }

      if (!isValidPlan(latest.planJson)) {
        errorMessage.value = '最近计划数据异常，已忽略旧数据';
        plan.value = null;
        latestPlanId.value = null;
        planSource.value = null;
        ElMessage.warning('最近计划数据异常，请重新生成');
        return;
      }

      latestPlanId.value = latest.id ?? null;
      if (!goalText.value) {
        goalText.value = latest.goalText;
      }
      plan.value = latest.planJson;
      planSource.value = null;
    } catch {
      errorMessage.value = '读取本地计划失败，但你仍可继续生成新计划';
      ElMessage.warning('读取本地计划失败，但不影响继续使用');
    }
  };

  const goHome = async (): Promise<void> => {
    await router.push({ name: 'Home' });
  };

  onMounted(async () => {
    const goalFromQuery = typeof route.query.goal === 'string' ? route.query.goal.trim() : '';
    if (goalFromQuery) {
      goalText.value = goalFromQuery;
    }

    await restoreLatestPlan();
  });

  return {
    deleting,
    errorMessage,
    goalText,
    goHome,
    handleDeleteLatest,
    handleGenerate,
    latestPlanId,
    levelText,
    loading,
    goToPlanHistory,
    openExerciseLibrary,
    plan,
    progressLabel,
    sourceLabel,
    sourceTagClass,
    startWorkout
  };
};
