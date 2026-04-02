import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { generatePlanApiWithSource, generatePlanStream } from '@/api/plans';
import { fetchExercises } from '@/api/exercises';
import { useEditablePlanDraft } from '@/composables/plan/useEditablePlanDraft';
import { syncPlansForUser } from '@/composables/plan/usePlanSync';
import { planSyncStateRepository, plansRepository } from '@/repositories';
import { useAuthStore } from '@/store/auth';
import type { PlanDisplaySource, PlanEditChangeSummary, PlanExercise, PlanStreamEvent, TrainingPlan } from '@/types/plan';
import { clearPlanEditingSession, loadPlanEditingSession, savePlanEditingSession } from '@/utils/plan-editing-session';
import { buildPlanEditChangeSummary, buildPlanEditChangeSummaryHighlights, buildPlanEditChangeSummaryMessage } from '@/utils/plan-edit-change-summary';
import { createPlanExerciseFromExerciseLibraryItem } from '@/utils/plan-exercise-replacement';

const cloneTrainingPlan = (plan: TrainingPlan): TrainingPlan => JSON.parse(JSON.stringify(plan)) as TrainingPlan;

const isValidPlanExercise = (value: unknown): value is PlanExercise => {
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

const isValidTrainingPlan = (value: unknown): value is TrainingPlan => {
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
    candidate.exercises.every((exercise) => isValidPlanExercise(exercise))
  );
};

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
  const latestPlanId = ref<number | null>(null);
  const planSource = ref<PlanDisplaySource | null>(null);
  const progressState = ref<PlanStreamEvent['type'] | null>(null);
  const generationRound = ref(0);
  const skipUnsavedChangesPromptOnce = ref(false);
  const lastSavedPlanEditSummary = ref<PlanEditChangeSummary | null>(null);

  const {
    appendEditingPlanExercise,
    buildValidatedEditingPlan,
    cancelEditingPlan,
    clearEditingPlanDraft,
    editablePlanDraft,
    hasUnsavedEditingPlanChanges,
    isEditingPlan,
    moveEditingPlanExerciseDown,
    moveEditingPlanExerciseUp,
    removeEditingPlanExercise,
    replaceEditingPlanExercise,
    restoreEditingPlanDraft,
    syncEditingPlanDraftAsSaved,
    startEditingPlan,
    updateEditingPlanDuration,
    updateEditingPlanTitle
  } = useEditablePlanDraft({
    notifyWarning: (message) => {
      ElMessage.warning(message);
    }
  });

  const currentUserId = computed(() => authStore.currentUser?.id ?? null);
  const levelText = computed(() => {
    const targetPlan = isEditingPlan.value ? editablePlanDraft.value : plan.value;
    if (!targetPlan) {
      return '未知难度';
    }

    return targetPlan.level === 'intermediate' ? '进阶级' : '入门级';
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

  const hasLastSavedPlanEditSummary = computed(() => Boolean(lastSavedPlanEditSummary.value?.hasChanges));
  const latestSavedPlanEditSummaryHighlights = computed(() =>
    lastSavedPlanEditSummary.value ? buildPlanEditChangeSummaryHighlights(lastSavedPlanEditSummary.value) : []
  );

  const resolveCurrentUserId = (): number | null => {
    const userId = currentUserId.value;
    if (!userId) {
      ElMessage.error('登录状态已失效，请重新登录');
      return null;
    }

    return userId;
  };

  const markNextNavigationAsPromptSafe = (): void => {
    skipUnsavedChangesPromptOnce.value = true;
  };

  const runPromptSafeNavigation = async (navigation: () => Promise<unknown>): Promise<void> => {
    markNextNavigationAsPromptSafe();

    try {
      await navigation();
    } catch (error) {
      skipUnsavedChangesPromptOnce.value = false;
      throw error;
    }
  };

  const confirmDiscardUnsavedPlanChanges = async (): Promise<boolean> => {
    if (!hasUnsavedEditingPlanChanges.value) {
      return true;
    }

    try {
      await ElMessageBox.confirm('当前编辑内容尚未保存，离开后会丢失这些修改。', '放弃未保存变更？', {
        confirmButtonText: '确认离开',
        cancelButtonText: '继续编辑',
        type: 'warning'
      });
      return true;
    } catch {
      return false;
    }
  };

  const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (!hasUnsavedEditingPlanChanges.value) {
      return;
    }

    event.preventDefault();
    event.returnValue = '';
  };

  const clearLastSavedPlanEditSummary = (): void => {
    lastSavedPlanEditSummary.value = null;
  };

  const applyPlanState = (nextPlan: TrainingPlan, source: PlanDisplaySource | null): void => {
    plan.value = cloneTrainingPlan(nextPlan);
    planSource.value = source;
    clearEditingPlanDraft();
  };

  const resolvePlanIdFromQuery = (): number | null => {
    const rawPlanId = Array.isArray(route.query.planId) ? route.query.planId[0] : route.query.planId;
    const planId = Number(rawPlanId);
    return Number.isFinite(planId) && planId > 0 ? planId : null;
  };

  const resolveReplacementExerciseIdFromQuery = (): string | null => {
    const rawExerciseId = Array.isArray(route.query.replaceExerciseId) ? route.query.replaceExerciseId[0] : route.query.replaceExerciseId;
    return typeof rawExerciseId === 'string' && rawExerciseId.trim().length > 0 ? rawExerciseId.trim() : null;
  };

  const resolveReplacementExerciseIndexFromQuery = (): number | null => {
    const rawExerciseIndex = Array.isArray(route.query.replaceExerciseIndex)
      ? route.query.replaceExerciseIndex[0]
      : route.query.replaceExerciseIndex;
    const exerciseIndex = Number(rawExerciseIndex);
    return Number.isFinite(exerciseIndex) && exerciseIndex >= 0 ? exerciseIndex : null;
  };

  const resolveAppendedExerciseIdFromQuery = (): string | null => {
    const rawExerciseId = Array.isArray(route.query.appendExerciseId) ? route.query.appendExerciseId[0] : route.query.appendExerciseId;
    return typeof rawExerciseId === 'string' && rawExerciseId.trim().length > 0 ? rawExerciseId.trim() : null;
  };

  const isReturningFromExerciseSelection = (): boolean =>
    Boolean(resolveReplacementExerciseIdFromQuery()) ||
    resolveReplacementExerciseIndexFromQuery() !== null ||
    Boolean(resolveAppendedExerciseIdFromQuery());

  const clearExerciseSelectionQueryState = async (): Promise<void> => {
    const nextQuery = { ...route.query };
    delete nextQuery.replaceExerciseId;
    delete nextQuery.replaceExerciseIndex;
    delete nextQuery.appendExerciseId;

    await runPromptSafeNavigation(async () => {
      await router.replace({
        name: 'PlanGenerator',
        query: nextQuery
      });
    });
  };

  const openExerciseLibrary = (keyword = ''): void => {
    const query = keyword ? { q: keyword } : {};
    router.push({ name: 'Exercises', query });
  };

  const goToPlanHistory = async (): Promise<void> => {
    if (!(await confirmDiscardUnsavedPlanChanges())) {
      return;
    }

    await runPromptSafeNavigation(async () => {
      await router.push({ name: 'PlanHistory' });
    });
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

  const enterEditMode = (): void => {
    if (!plan.value) {
      ElMessage.warning('当前没有可编辑的训练计划');
      return;
    }

    startEditingPlan(plan.value);
  };

  const cancelEdit = async (): Promise<void> => {
    if (hasUnsavedEditingPlanChanges.value) {
      const confirmed = await confirmDiscardUnsavedPlanChanges();
      if (!confirmed) {
        return;
      }
    }

    cancelEditingPlan();
    clearPlanEditingSession();
  };

  const startExerciseReplacement = async (exerciseIndex: number): Promise<void> => {
    if (!isEditingPlan.value || !editablePlanDraft.value || !latestPlanId.value) {
      ElMessage.warning('请先进入计划编辑状态，再替换动作');
      return;
    }

    const targetExercise = editablePlanDraft.value.exercises[exerciseIndex];
    if (!targetExercise) {
      ElMessage.warning('当前动作不存在，请刷新后重试');
      return;
    }

    savePlanEditingSession({
      latestPlanId: latestPlanId.value,
      goalText: goalText.value.trim(),
      editablePlanDraft: editablePlanDraft.value
    });

    await runPromptSafeNavigation(async () => {
      await router.push({
        name: 'Exercises',
        query: {
          q: targetExercise.name,
          mode: 'replacePlanExercise',
          planId: String(latestPlanId.value),
          replaceExerciseIndex: String(exerciseIndex)
        }
      });
    });
  };

  const startAppendingExerciseToPlan = async (): Promise<void> => {
    if (!isEditingPlan.value || !editablePlanDraft.value || !latestPlanId.value) {
      ElMessage.warning('请先进入计划编辑状态，再添加动作');
      return;
    }

    savePlanEditingSession({
      latestPlanId: latestPlanId.value,
      goalText: goalText.value.trim(),
      editablePlanDraft: editablePlanDraft.value
    });

    await runPromptSafeNavigation(async () => {
      await router.push({
        name: 'Exercises',
        query: {
          mode: 'appendPlanExercise',
          planId: String(latestPlanId.value)
        }
      });
    });
  };

  const applyReplacementExerciseFromRoute = async (): Promise<void> => {
    const selectedExerciseId = resolveReplacementExerciseIdFromQuery();
    const targetExerciseIndex = resolveReplacementExerciseIndexFromQuery();
    const editingSessionSnapshot = loadPlanEditingSession();

    if (!selectedExerciseId || targetExerciseIndex === null) {
      return;
    }

    if (!editingSessionSnapshot || !latestPlanId.value || editingSessionSnapshot.latestPlanId !== latestPlanId.value) {
      clearPlanEditingSession();
      ElMessage.warning('未找到可恢复的编辑草稿，请重新进入编辑模式后再替换动作');
      await clearExerciseSelectionQueryState();
      return;
    }

    const exercises = await fetchExercises();
    const selectedExercise = exercises.find((item) => item.id === selectedExerciseId);

    if (!selectedExercise) {
      clearPlanEditingSession();
      ElMessage.warning('未找到要替换的动作，请重新选择');
      await clearExerciseSelectionQueryState();
      return;
    }

    goalText.value = editingSessionSnapshot.goalText || goalText.value;
    restoreEditingPlanDraft(editingSessionSnapshot.editablePlanDraft);
    replaceEditingPlanExercise(targetExerciseIndex, createPlanExerciseFromExerciseLibraryItem(selectedExercise));
    clearPlanEditingSession();
    planSource.value = 'edited';
    ElMessage.success(`已将动作替换为“${selectedExercise.name}”`);
    await clearExerciseSelectionQueryState();
  };

  const applyAppendedExerciseFromRoute = async (): Promise<void> => {
    const selectedExerciseId = resolveAppendedExerciseIdFromQuery();
    const editingSessionSnapshot = loadPlanEditingSession();

    if (!selectedExerciseId) {
      return;
    }

    if (!editingSessionSnapshot || !latestPlanId.value || editingSessionSnapshot.latestPlanId !== latestPlanId.value) {
      clearPlanEditingSession();
      ElMessage.warning('未找到可恢复的编辑草稿，请重新进入编辑模式后再添加动作');
      await clearExerciseSelectionQueryState();
      return;
    }

    const exercises = await fetchExercises();
    const selectedExercise = exercises.find((item) => item.id === selectedExerciseId);

    if (!selectedExercise) {
      clearPlanEditingSession();
      ElMessage.warning('未找到要添加的动作，请重新选择');
      await clearExerciseSelectionQueryState();
      return;
    }

    goalText.value = editingSessionSnapshot.goalText || goalText.value;
    restoreEditingPlanDraft(editingSessionSnapshot.editablePlanDraft);
    appendEditingPlanExercise(createPlanExerciseFromExerciseLibraryItem(selectedExercise));
    clearPlanEditingSession();
    planSource.value = 'edited';
    ElMessage.success(`已添加动作“${selectedExercise.name}”`);
    await clearExerciseSelectionQueryState();
  };

  const saveEditedPlan = async (): Promise<void> => {
    if (!isEditingPlan.value || loading.value || deleting.value || savingEdits.value) {
      return;
    }

    const userId = resolveCurrentUserId();
    if (!userId || !latestPlanId.value) {
      return;
    }

    const validatedPlan = buildValidatedEditingPlan();
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

      const planEditChangeSummary = buildPlanEditChangeSummary(existingPlan.planJson, validatedPlan);

      await syncPlansForUser(userId).catch(() => {
        ElMessage.warning('本地计划已更新，云端同步稍后重试');
      });
      const syncedPlan = await plansRepository.getPlanByClientPlanId(userId, updatedPlan.clientPlanId);

      latestPlanId.value = syncedPlan?.id ?? updatedPlan.id ?? latestPlanId.value;
      lastSavedPlanEditSummary.value = planEditChangeSummary;
      syncEditingPlanDraftAsSaved();
      applyPlanState(validatedPlan, 'edited');
      clearPlanEditingSession();
      ElMessage.success(buildPlanEditChangeSummaryMessage(planEditChangeSummary));
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

    if (!(await confirmDiscardUnsavedPlanChanges())) {
      return;
    }

    loading.value = true;
    errorMessage.value = '';
    progressState.value = 'queued';
    clearEditingPlanDraft();
    clearPlanEditingSession();
    clearLastSavedPlanEditSummary();
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

      if (!isValidTrainingPlan(streamed.plan)) {
        throw new Error('计划数据异常，请重试');
      }

      applyPlanState(streamed.plan, streamed.source ?? null);
    } catch {
      try {
        const fallback = await generatePlanApiWithSource(trimmedGoal);
        if (currentRound !== generationRound.value) {
          return;
        }

        if (!isValidTrainingPlan(fallback.plan)) {
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

      const saved = await plansRepository.saveLatestPlan({
        userId,
        goalText: trimmedGoal,
        plan: cloneTrainingPlan(plan.value)
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

    if (!(await confirmDiscardUnsavedPlanChanges())) {
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
      clearEditingPlanDraft();
      clearPlanEditingSession();
      clearLastSavedPlanEditSummary();
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
      const latestPlan = await plansRepository.loadLatestPlan(userId);
      if (!latestPlan) {
        return;
      }

      if (!isValidTrainingPlan(latestPlan.planJson)) {
        errorMessage.value = '最近计划数据异常，已忽略旧数据';
        plan.value = null;
        latestPlanId.value = null;
        planSource.value = null;
        clearEditingPlanDraft();
        clearPlanEditingSession();
        clearLastSavedPlanEditSummary();
        ElMessage.warning('最近计划数据异常，请重新生成');
        return;
      }

      latestPlanId.value = latestPlan.id ?? null;
      if (!goalText.value) {
        goalText.value = latestPlan.goalText;
      }
      clearLastSavedPlanEditSummary();
      applyPlanState(latestPlan.planJson, 'restored');
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
      const targetPlan = await plansRepository.getPlanById(userId, planId);
      if (!targetPlan) {
        ElMessage.warning('未找到要复用的历史计划，已为你保留当前内容');
        return false;
      }

      if (!isValidTrainingPlan(targetPlan.planJson)) {
        ElMessage.warning('历史计划数据异常，请重新生成');
        return false;
      }

      latestPlanId.value = targetPlan.id ?? null;
      goalText.value = targetPlan.goalText;
      clearLastSavedPlanEditSummary();
      applyPlanState(targetPlan.planJson, 'restored');
      errorMessage.value = '';
      if (!isReturningFromExerciseSelection()) {
        ElMessage.success('已恢复历史计划，可直接开始训练或调整目标后重新生成');
      }
      return true;
    } catch {
      ElMessage.warning('读取历史计划失败，请稍后重试');
      return false;
    }
  };

  const goHome = async (): Promise<void> => {
    if (!(await confirmDiscardUnsavedPlanChanges())) {
      return;
    }

    await runPromptSafeNavigation(async () => {
      await router.push({ name: 'Home' });
    });
  };

  onBeforeRouteLeave(async () => {
    if (skipUnsavedChangesPromptOnce.value) {
      skipUnsavedChangesPromptOnce.value = false;
      return true;
    }

    if (!hasUnsavedEditingPlanChanges.value) {
      return true;
    }

    return await confirmDiscardUnsavedPlanChanges();
  });

  onMounted(async () => {
    window.addEventListener('beforeunload', handleBeforeUnload);

    const goalFromQuery = typeof route.query.goal === 'string' ? route.query.goal.trim() : '';
    if (goalFromQuery) {
      goalText.value = goalFromQuery;
    }

    const restoredFromHistory = await restorePlanFromHistory();
    if (!restoredFromHistory) {
      await restoreLatestPlan();
    }

    await applyReplacementExerciseFromRoute();
    await applyAppendedExerciseFromRoute();
  });

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  });

  return {
    cancelEdit,
    deleting,
    editablePlanDraft,
    enterEditMode,
    errorMessage,
    goalText,
    goHome,
    goToPlanHistory,
    hasLastSavedPlanEditSummary,
    handleDeleteLatest,
    handleGenerate,
    isEditingPlan,
    latestPlanId,
    levelText,
    loading,
    moveExerciseDown: moveEditingPlanExerciseDown,
    moveExerciseUp: moveEditingPlanExerciseUp,
    latestSavedPlanEditSummaryHighlights,
    openExerciseLibrary,
    plan,
    progressLabel,
    removeExercise: removeEditingPlanExercise,
    saveEditedPlan,
    savingEdits,
    sourceLabel,
    sourceTagClass,
    startAppendingExerciseToPlan,
    startExerciseReplacement,
    startWorkout,
    updateDraftDuration: updateEditingPlanDuration,
    updateDraftTitle: updateEditingPlanTitle
  };
};

