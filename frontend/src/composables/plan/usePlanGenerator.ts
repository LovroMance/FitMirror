import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { generatePlanApiWithSource, generatePlanStream } from '@/api/plans';
import { syncPlansForUser } from '@/composables/plan/usePlanSync';
import { useAuthStore } from '@/store/auth';
import type {
  EditableTrainingPlanDraft,
  PlanDisplaySource,
  PlanExercise,
  PlanStreamEvent,
  TrainingPlan
} from '@/types/plan';
import { planSyncStateRepository, plansRepository } from '@/repositories';

const clonePlan = (plan: TrainingPlan): TrainingPlan => JSON.parse(JSON.stringify(plan)) as TrainingPlan;

const toEditablePlanDraft = (plan: TrainingPlan): EditableTrainingPlanDraft => ({
  title: plan.title,
  level: plan.level,
  durationMinutes: plan.durationMinutes,
  summary: plan.summary,
  exercises: plan.exercises.map((exercise) => ({ ...exercise }))
});

export const usePlanGenerator = () => {
  const router = useRouter();
  const route = useRoute();
  const authStore = useAuthStore();

  const goalText = ref('');
  const loading = ref(false);
  const deleting = ref(false);
  const savingEdits = ref(false);
  const errorMessage = ref('');
  const plan = ref<TrainingPlan | null>(null);
  const editablePlanDraft = ref<EditableTrainingPlanDraft | null>(null);
  const latestPlanId = ref<number | null>(null);
  const planSource = ref<PlanDisplaySource | null>(null);
  const progressState = ref<PlanStreamEvent['type'] | null>(null);
  const generationRound = ref(0);
  const isEditingPlan = ref(false);

  const currentUserId = computed(() => authStore.currentUser?.id ?? null);
  const levelText = computed(() => {
    const targetPlan = isEditingPlan.value ? editablePlanDraft.value : plan.value;
    if (!targetPlan) {
      return '未知难度';
    }

    if (targetPlan.level === 'beginner') {
      return '入门级';
    }

    if (targetPlan.level === 'intermediate') {
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

    if (planSource.value === 'edited') {
      return '已编辑';
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

    if (planSource.value === 'edited') {
      return 'edited';
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

  const resetEditingState = (): void => {
    isEditingPlan.value = false;
    editablePlanDraft.value = null;
    savingEdits.value = false;
  };

  const applyPlanState = (nextPlan: TrainingPlan, source: PlanDisplaySource | null): void => {
    plan.value = clonePlan(nextPlan);
    planSource.value = source;
    resetEditingState();
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

    if (isEditingPlan.value) {
      ElMessage.warning('请先保存当前编辑内容，再开始训练');
      return;
    }

    await router.push({
      name: 'WorkoutSession',
      query: { planId: String(latestPlanId.value) }
    });
  };

  const resolvePlanIdFromQuery = (): number | null => {
    const raw = Array.isArray(route.query.planId) ? route.query.planId[0] : route.query.planId;
    const planId = Number(raw);

    return Number.isFinite(planId) && planId > 0 ? planId : null;
  };

  const enterEditMode = (): void => {
    if (!plan.value) {
      ElMessage.warning('当前没有可编辑的训练计划');
      return;
    }

    editablePlanDraft.value = toEditablePlanDraft(plan.value);
    isEditingPlan.value = true;
  };

  const cancelEdit = (): void => {
    if (!isEditingPlan.value) {
      return;
    }

    resetEditingState();
  };

  const updateDraftTitle = (value: string): void => {
    if (!editablePlanDraft.value) {
      return;
    }

    editablePlanDraft.value.title = value;
  };

  const updateDraftDuration = (value: number | null | undefined): void => {
    if (!editablePlanDraft.value) {
      return;
    }

    editablePlanDraft.value.durationMinutes = typeof value === 'number' ? value : 0;
  };

  const moveExercise = (fromIndex: number, toIndex: number): void => {
    if (!editablePlanDraft.value) {
      return;
    }

    const exercises = editablePlanDraft.value.exercises;
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= exercises.length ||
      toIndex >= exercises.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const reordered = [...exercises];
    const [targetExercise] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, targetExercise);
    editablePlanDraft.value.exercises = reordered;
  };

  const moveExerciseUp = (index: number): void => {
    moveExercise(index, index - 1);
  };

  const moveExerciseDown = (index: number): void => {
    moveExercise(index, index + 1);
  };

  const removeExercise = (index: number): void => {
    if (!editablePlanDraft.value) {
      return;
    }

    if (editablePlanDraft.value.exercises.length <= 1) {
      ElMessage.warning('训练计划至少需要保留 1 个动作');
      return;
    }

    editablePlanDraft.value.exercises = editablePlanDraft.value.exercises.filter((_, exerciseIndex) => exerciseIndex !== index);
  };

  const buildValidatedDraftPlan = (): TrainingPlan | null => {
    if (!editablePlanDraft.value) {
      ElMessage.warning('当前没有可保存的编辑内容');
      return null;
    }

    const normalizedTitle = editablePlanDraft.value.title.trim();
    if (!normalizedTitle) {
      ElMessage.warning('请输入训练计划标题');
      return null;
    }

    if (!Number.isInteger(editablePlanDraft.value.durationMinutes) || editablePlanDraft.value.durationMinutes <= 0) {
      ElMessage.warning('总时长需为正整数分钟');
      return null;
    }

    if (editablePlanDraft.value.exercises.length === 0) {
      ElMessage.warning('训练计划至少需要保留 1 个动作');
      return null;
    }

    const validatedPlan: TrainingPlan = {
      ...editablePlanDraft.value,
      title: normalizedTitle,
      exercises: editablePlanDraft.value.exercises.map((exercise) => ({ ...exercise }))
    };

    if (!isValidPlan(validatedPlan)) {
      ElMessage.warning('训练计划数据异常，请检查后重试');
      return null;
    }

    return validatedPlan;
  };

  const saveEditedPlan = async (): Promise<void> => {
    if (!isEditingPlan.value || loading.value || deleting.value || savingEdits.value) {
      return;
    }

    const userId = resolveCurrentUserId();
    if (!userId || !latestPlanId.value) {
      return;
    }

    const validatedPlan = buildValidatedDraftPlan();
    if (!validatedPlan) {
      return;
    }

    savingEdits.value = true;
    errorMessage.value = '';

    try {
      const existingPlan = await plansRepository.getPlanById(userId, latestPlanId.value);
      if (!existingPlan) {
        throw new Error('当前计划不存在，请重新生成或恢复后再试');
      }

      const updatedPlan = await plansRepository.updatePlanById(userId, latestPlanId.value, {
        goalText: goalText.value.trim() || existingPlan.goalText,
        plan: validatedPlan
      });

      if (!updatedPlan) {
        throw new Error('当前计划不存在，请重新生成或恢复后再试');
      }

      await syncPlansForUser(userId).catch(() => {
        ElMessage.warning('本地计划已更新，云端同步稍后重试');
      });
      const syncedPlan = await plansRepository.getPlanByClientPlanId(userId, updatedPlan.clientPlanId);

      latestPlanId.value = syncedPlan?.id ?? updatedPlan.id ?? latestPlanId.value;
      applyPlanState(validatedPlan, 'edited');
      ElMessage.success('训练计划已更新');
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存编辑内容失败，请稍后重试';
      errorMessage.value = message;
      ElMessage.error(message);
    } finally {
      savingEdits.value = false;
    }
  };

  const handleGenerate = async (): Promise<void> => {
    if (loading.value || deleting.value || savingEdits.value) {
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
    resetEditingState();
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

      applyPlanState(streamed.plan, streamed.source ?? null);
    } catch {
      try {
        const fallback = await generatePlanApiWithSource(trimmedGoal);
        if (currentRound !== generationRound.value) {
          return;
        }

        if (!isValidPlan(fallback.plan)) {
          throw new Error('计划数据异常，请重试');
        }

        applyPlanState(fallback.plan, fallback.source ?? 'template');
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

      const persistedPlan = clonePlan(plan.value);

      const saved = await plansRepository.saveLatestPlan({
        userId,
        goalText: trimmedGoal,
        plan: persistedPlan
      });
      await syncPlansForUser(userId).catch(() => {
        ElMessage.warning('本地计划已保存，云端同步稍后重试');
      });
      const syncedPlan = await plansRepository.getPlanByClientPlanId(userId, saved.clientPlanId);

      if (currentRound !== generationRound.value) {
        return;
      }

      latestPlanId.value = syncedPlan?.id ?? saved.id ?? null;
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
    if (loading.value || deleting.value || savingEdits.value) {
      return;
    }

    const userId = resolveCurrentUserId();
    if (!userId) {
      return;
    }

    deleting.value = true;
    errorMessage.value = '';

    try {
      const targetPlan =
        latestPlanId.value !== null ? await plansRepository.getPlanById(userId, latestPlanId.value) : await plansRepository.loadLatestPlan(userId);
      await plansRepository.deletePlan(userId, latestPlanId.value ?? undefined);
      if (targetPlan) {
        await planSyncStateRepository.markPlanDeleted(userId, targetPlan.clientPlanId);
      }
      await syncPlansForUser(userId).catch(() => {
        ElMessage.warning('本地计划已删除，云端同步稍后重试');
      });
      latestPlanId.value = null;
      plan.value = null;
      planSource.value = null;
      resetEditingState();
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
      await syncPlansForUser(userId).catch(() => undefined);
      const latest = await plansRepository.loadLatestPlan(userId);
      if (!latest) {
        return;
      }

      if (!isValidPlan(latest.planJson)) {
        errorMessage.value = '最近计划数据异常，已忽略旧数据';
        plan.value = null;
        latestPlanId.value = null;
        planSource.value = null;
        resetEditingState();
        ElMessage.warning('最近计划数据异常，请重新生成');
        return;
      }

      latestPlanId.value = latest.id ?? null;
      if (!goalText.value) {
        goalText.value = latest.goalText;
      }
      applyPlanState(latest.planJson, 'restored');
    } catch {
      errorMessage.value = '读取本地计划失败，但你仍可继续生成新计划';
      ElMessage.warning('读取本地计划失败，但不影响继续使用');
    }
  };

  const restorePlanFromHistory = async (): Promise<boolean> => {
    const userId = resolveCurrentUserId();
    const planId = resolvePlanIdFromQuery();
    if (!userId || !planId) {
      return false;
    }

    try {
      await syncPlansForUser(userId).catch(() => undefined);
      const target = await plansRepository.getPlanById(userId, planId);
      if (!target) {
        ElMessage.warning('未找到要复用的历史计划，已为你保留当前内容');
        return false;
      }

      if (!isValidPlan(target.planJson)) {
        ElMessage.warning('历史计划数据异常，请重新生成');
        return false;
      }

      latestPlanId.value = target.id ?? null;
      goalText.value = target.goalText;
      applyPlanState(target.planJson, 'restored');
      errorMessage.value = '';
      ElMessage.success('已恢复历史计划，可直接开始训练或调整目标后重新生成');
      return true;
    } catch {
      ElMessage.warning('读取历史计划失败，请稍后重试');
      return false;
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

    const restoredFromHistory = await restorePlanFromHistory();
    if (restoredFromHistory) {
      return;
    }

    await restoreLatestPlan();
  });

  return {
    cancelEdit,
    deleting,
    editablePlanDraft,
    enterEditMode,
    errorMessage,
    goHome,
    goalText,
    handleDeleteLatest,
    handleGenerate,
    isEditingPlan,
    latestPlanId,
    levelText,
    loading,
    goToPlanHistory,
    moveExerciseDown,
    moveExerciseUp,
    openExerciseLibrary,
    plan,
    progressLabel,
    removeExercise,
    saveEditedPlan,
    savingEdits,
    sourceLabel,
    sourceTagClass,
    startWorkout,
    updateDraftDuration,
    updateDraftTitle
  };
};
